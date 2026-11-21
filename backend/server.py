from http.server import ThreadingHTTPServer as HTTPServer, SimpleHTTPRequestHandler
from pathlib import Path
from urllib.parse import parse_qs, unquote, urlparse
import json
import os
import posixpath
import re
import traceback
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

import admin_common
import admin_catalog
import currencies
import rewards
import settings
import admin_banners
import admin_orders
import admin_pitcoins
import admin_products
import admin_races
import admin_teams
import admin_users
import admin_audit
import uploads
from admin_api import admin_login, get_session_profile
from admin_dashboard import get_dashboard, get_sales
from auth import change_password, login_user, register_user
from avatar import buy_avatar_item, get_avatar, save_avatar
from bets import get_leaderboard, get_race_detail, get_user_bets, list_races, place_bet
from cart import add_to_cart, get_cart, remove_cart_item, update_cart_item
from categories import get_categories, get_colors, get_sizes, get_teams
from coins import adjust_balance, get_movements
from database import request_scope, test_connection
from home import get_home
from orders import get_user_orders
from payments_sim import simulate_payment
from products import filter_products, get_product_detail, get_products, search_products
import progression
from users import get_user, list_users, update_user
from utils import json_default
from security import (clear_cookie, complete_reset, create_session, read_session,
                      request_reset, revoke_session, session_cookie)

BASE_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = BASE_DIR / "frontend"
# En local escucha solo en este computador. En la nube (Render) se define
# PURPLE1_HOST=0.0.0.0 para que el proxy de la plataforma pueda llegar.
HOST = os.getenv("PURPLE1_HOST", "127.0.0.1").strip() or "127.0.0.1"
# Puerto del servidor (8000). Si esta ocupado: $env:PURPLE1_PORT = "8080" antes de python main.py.
# En la nube la plataforma asigna el puerto en la variable PORT.
PORT = int(os.getenv("PURPLE1_PORT") or os.getenv("PORT") or "8000")
# Detras de Vercel y Render la IP que ve el servidor es la del proxy. Solo si
# PURPLE1_TRUST_PROXY=1 se lee la IP del cliente desde X-Forwarded-For.
TRUST_PROXY = os.getenv("PURPLE1_TRUST_PROXY", "0") == "1"
# Dominios desde los que se aceptan peticiones que cambian datos, ademas del propio.
# Ejemplo en Render: PURPLE1_ALLOWED_ORIGINS=purple1.vercel.app
ALLOWED_ORIGIN_HOSTS = {
    host.strip().lower().removeprefix("https://").removeprefix("http://").rstrip("/")
    for host in os.getenv("PURPLE1_ALLOWED_ORIGINS", "").split(",") if host.strip()
}

# Archivos del panel que se sirven sin sesion: no contienen datos.
ADMIN_PUBLIC_FILES = {"/admin/login.html", "/admin/js/login.js", "/admin/css/admin.css"}
ADMIN_LOGIN_PAGE = "/admin/login.html"

# Rutas del panel que solo puede usar el superadministrador (el resto: cualquier staff).
# Se valida aqui, en el backend, en cada peticion; el menu solo oculta las opciones.
SUPERADMIN_API = (
    re.compile(r"/api/admin/users/\d{1,10}/access"),   # cambiar roles y activar/desactivar
    re.compile(r"/api/admin/pitcoins(/[a-z]+)?"),        # movimientos y ajustes manuales
    re.compile(r"/api/admin/audit"),                     # registro de auditoria
    re.compile(r"/api/admin/currencies(/[A-Za-z]{3})?"), # monedas y tasas de cambio
    re.compile(r"/api/admin/discount-rewards(/\d+)?"),  # descuentos canjeables con PitCoins
    re.compile(r"/api/admin/settings"),                  # parametros de PitCoins, XP y cupones
)


def list_limit(params, default):
    """?limit=N de los historiales del perfil, acotado entre 1 y 500."""
    try:
        return max(1, min(int((params.get("limit") or [default])[0]), 500))
    except (TypeError, ValueError):
        return default


def superadmin_only(path):
    return any(pattern.fullmatch(path) for pattern in SUPERADMIN_API)


def admin_page_path(raw_path):
    """Ruta normalizada en minusculas si apunta al panel; None si no.

    Se normaliza antes de comparar: '/x/../admin/', '%61dmin' o '/ADMIN/' (en
    Windows el sistema de archivos no distingue mayusculas) siguen protegidos."""
    # normpath conserva una doble barra inicial ('//admin'): se quitan antes.
    path = posixpath.normpath("/" + unquote(raw_path).replace("\\", "/").lstrip("/")).lower()
    if path == "/admin" or path.startswith("/admin/"):
        return path
    return None


class PurpleOneHandler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(FRONTEND_DIR), **kwargs)

    def log_message(self, format, *args):
        # El enlace de recuperación contiene un token en la URL.
        print(f"{self.client_address[0]} {self.command} {urlparse(self.path).path}")

    def end_headers(self):
        if getattr(self, "_static", False):
            # Revalidar siempre (304 si no cambio): tras actualizar el panel no queda un JS viejo en cache.
            self.send_header("Cache-Control", "no-cache")
        self.send_header("Referrer-Policy", "no-referrer")
        self.send_header("X-Content-Type-Options", "nosniff")
        self.send_header("X-Frame-Options", "DENY")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_error_json("Origen no permitido.", 403)

    def current_user(self):
        return read_session(self.headers.get("Cookie"))

    def require_user(self):
        user = self.current_user()
        if not user:
            self.send_error_json("Inicia sesión para continuar.", 401)
        return user

    def require_staff(self):
        """Unico control de acceso del panel: el rol se lee de la BD en cada peticion."""
        user = self.current_user()
        if not user:
            self.send_error_json("Inicia sesión para continuar.", 401)
            return None
        if not user["is_staff"]:
            self.send_error_json("Acceso restringido.", 403)
            return None
        return user

    def client_ip(self):
        # Sin proxy de confianza: X-Forwarded-For lo controla el cliente y no se usa.
        # Con PURPLE1_TRUST_PROXY=1 (despliegue en la nube) se toma la primera IP
        # de X-Forwarded-For, que escribe el proxy de Vercel con la IP real del cliente.
        if TRUST_PROXY:
            forwarded = (self.headers.get("X-Forwarded-For") or "").split(",")[0].strip()
            if forwarded and len(forwarded) <= 45:
                return forwarded
        return self.client_address[0] if self.client_address else ""

    def redirect(self, location):
        self.send_response(302)
        self.send_header("Location", location)
        self.send_header("Cache-Control", "no-store")
        self.send_header("Content-Length", "0")
        self.end_headers()

    def admin_page_gate(self, raw_path):
        """True si la peticion ya se respondio (redireccion al login o al panel)."""
        path = admin_page_path(raw_path)
        if path is None:
            return False
        if path == "/admin":
            self.redirect("/admin/index.html")
            return True
        if path in ADMIN_PUBLIC_FILES:
            return False
        try:
            user = self.current_user()
        except Exception as exc:  # noqa: BLE001 - p. ej. MySQL no disponible
            self.log_internal_error(exc)
            self.send_error(503, "Servicio no disponible")
            return True
        if not user or not user["is_staff"]:
            self.redirect(ADMIN_LOGIN_PAGE)
            return True
        return False

    def same_origin(self):
        origin = self.headers.get("Origin") or self.headers.get("Referer")
        if not origin:
            return not self.headers.get("Cookie")
        parsed = urlparse(origin)
        if parsed.scheme not in ("http", "https"):
            return False
        # En la nube el navegador habla con el dominio de Vercel y Vercel reenvia la
        # peticion a Render con otro Host: ese dominio se autoriza de forma explicita.
        return parsed.netloc == self.headers.get("Host") or parsed.netloc.lower() in ALLOWED_ORIGIN_HOSTS

    def read_json(self):
        length = int(self.headers.get("Content-Length", "0") or "0")
        if length > 1048576 or length < 0:
            raise ValueError("Solicitud demasiado grande.")
        if length == 0:
            return {}
        if not self.headers.get("Content-Type", "").startswith("application/json"):
            raise ValueError("Se requiere JSON.")
        raw = self.rfile.read(length).decode("utf-8")
        data = json.loads(raw) if raw else {}
        if not isinstance(data, dict):
            raise ValueError("Se requiere un objeto JSON.")
        return data

    def send_json(self, payload, status=200):
        body = json.dumps(payload, ensure_ascii=False, default=json_default).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        if getattr(self, "_session_cookie", None):
            self.send_header("Set-Cookie", self._session_cookie)
        self.end_headers()
        self.wfile.write(body)

    def send_error_json(self, message, status=400):
        self.send_json({"success": False, "error": message}, status)

    def log_internal_error(self, exc):
        # Solo tipo y ubicacion: el mensaje puede contener datos personales o SQL.
        frames = "; ".join(f"{Path(f.filename).name}:{f.lineno} {f.name}" for f in traceback.extract_tb(exc.__traceback__)[-3:])
        print(f"Error interno en {self.command} {urlparse(self.path).path}: {type(exc).__name__} ({frames})", flush=True)

    def do_HEAD(self):
        if self.admin_page_gate(urlparse(self.path).path):
            return
        return super().do_HEAD()

    def do_GET(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            if self.admin_page_gate(parsed.path):
                return
            self._static = True
            return super().do_GET()
        try:
            # Todas las consultas de esta lectura comparten una sola conexion.
            with request_scope():
                self.route_get(parsed.path, parse_qs(parsed.query))
        except (ValueError, json.JSONDecodeError):
            self.send_error_json("Solicitud inválida.", 400)
        except Exception as exc:
            self.log_internal_error(exc)
            self.send_error_json("Error interno.", 500)

    def do_POST(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self.send_error_json("Ruta no encontrada.", 404)
        if not self.same_origin():
            return self.send_error_json("Origen no permitido.", 403)
        try:
            if parsed.path == "/api/admin/uploads":
                return self.handle_admin_upload()
            self.route_post(parsed.path, self.read_json())
        except (ValueError, json.JSONDecodeError):
            self.send_error_json("Solicitud inválida.", 400)
        except Exception as exc:
            self.log_internal_error(exc)
            self.send_error_json("Error interno.", 500)

    def do_PUT(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self.send_error_json("Ruta no encontrada.", 404)
        if not self.same_origin():
            return self.send_error_json("Origen no permitido.", 403)
        try:
            self.route_put(parsed.path, self.read_json())
        except (ValueError, json.JSONDecodeError):
            self.send_error_json("Solicitud inválida.", 400)
        except Exception as exc:
            self.log_internal_error(exc)
            self.send_error_json("Error interno.", 500)

    def do_DELETE(self):
        parsed = urlparse(self.path)
        if not parsed.path.startswith("/api/"):
            return self.send_error_json("Ruta no encontrada.", 404)
        if not self.same_origin():
            return self.send_error_json("Origen no permitido.", 403)
        try:
            self.route_delete(parsed.path, parse_qs(parsed.query), self.read_json())
        except (ValueError, json.JSONDecodeError):
            self.send_error_json("Solicitud inválida.", 400)
        except Exception as exc:
            self.log_internal_error(exc)
            self.send_error_json("Error interno.", 500)

    def route_admin(self, method, path, params, data):
        """Todas las rutas /api/admin/* salvo el login exigen staff, incluidas las
        inexistentes: quien no es staff no puede averiguar que rutas existen."""
        if method == "POST" and path == "/api/admin/login":
            payload, error, status = admin_login(data, self.client_ip())
            if error:
                return self.send_error_json(error, status)
            self._session_cookie = session_cookie(create_session(payload["user"]["id"]))
            return self.send_json(payload, status)
        staff = self.require_staff()
        if not staff:
            return
        if superadmin_only(path) and not staff["is_superadmin"]:
            return self.send_error_json("Solo el superadministrador puede realizar esta acción.", 403)
        if method == "GET" and path == "/api/admin/session":
            profile = get_session_profile(staff["id"])
            if not profile:
                return self.send_error_json("Acceso restringido.", 403)
            profile["is_superadmin"] = staff["is_superadmin"]
            profile["role"] = "SUPERADMIN" if staff["is_superadmin"] else "STAFF"
            return self.send_json({"success": True, "user": profile})
        if method == "GET" and path == "/api/admin/dashboard":
            return self.send_json({"success": True, "dashboard": get_dashboard()})
        if method == "GET" and path == "/api/admin/sales":
            group = (params.get("group", ["day"])[0] or "day").lower()
            return self.send_json({"success": True, "sales": get_sales(group)})
        try:
            if self.route_admin_a7(method, path, params, data, staff["id"]):
                return
            if self.route_admin_products(method, path, params, data, staff["id"]):
                return
            if self.route_admin_catalog(method, path, data, staff["id"]):
                return
            if self.route_admin_currencies(method, path, data, staff["id"]):
                return
            if self.route_admin_config(method, path, data, staff["id"]):
                return
            if self.route_admin_teams(method, path, params, data, staff["id"]):
                return
            if self.route_admin_races(method, path, params, data, staff["id"]):
                return
            if self.route_admin_orders(method, path, params):
                return
        except admin_common.ValidationError as exc:
            return self.send_json({"success": False, "error": exc.message, "fields": exc.fields}, 400)
        except admin_common.ConflictError as exc:
            return self.send_error_json(str(exc), 409)
        except admin_common.NotFoundError as exc:
            return self.send_error_json(str(exc), 404)
        return self.send_error_json("Ruta no encontrada.", 404)

    def route_admin_currencies(self, method, path, data, actor_id):
        """Monedas y tasas (solo superadministrador: ver SUPERADMIN_API)."""
        match = re.fullmatch(r"/api/admin/currencies(?:/([A-Za-z]{3}))?", path)
        if not match:
            return False
        code = match.group(1)
        if method == "GET" and not code:
            self.send_json({"success": True, "items": currencies.admin_list()})
            return True
        if method == "POST" and not code:
            self.send_json({"success": True, "item": currencies.save(data.get("code"), data, actor_id, creating=True)}, 201)
            return True
        if method == "PUT" and code:
            self.send_json({"success": True, "item": currencies.save(code, data, actor_id)})
            return True
        return False

    def route_admin_config(self, method, path, data, actor_id):
        """Descuentos canjeables y parametros (solo superadministrador)."""
        match = re.fullmatch(r"/api/admin/discount-rewards(?:/(\d+))?", path)
        if match:
            rule_id = int(match.group(1)) if match.group(1) else None
            if method == "GET" and rule_id is None:
                self.send_json({"success": True, "items": rewards.admin_list(), "max_percent": rewards.max_percent()})
            elif method == "POST" and rule_id is None:
                self.send_json({"success": True, "item": rewards.save(None, data, actor_id)}, 201)
            elif method == "PUT" and rule_id:
                self.send_json({"success": True, "item": rewards.save(rule_id, data, actor_id)})
            else:
                return False
            return True
        if path == "/api/admin/settings":
            if method == "GET":
                self.send_json({"success": True, "items": settings.admin_list()})
            elif method == "PUT":
                self.send_json({"success": True, "items": settings.save(data, actor_id)})
            else:
                return False
            return True
        return False

    def route_admin_catalog(self, method, path, data, actor_id):
        """Categorias, tipos de producto, tallas y colores (admin_catalog.py)."""
        match = re.fullmatch(r"/api/admin/(categories|product-types|sizes|colors)(?:/(\d{1,10}))?", path)
        if not match:
            return False
        kind, item = match.group(1), match.group(2)
        item_id = int(item) if item else None
        listers = {"categories": admin_catalog.list_categories, "product-types": admin_catalog.list_product_types,
                   "sizes": lambda: admin_catalog.list_attribute("sizes"), "colors": lambda: admin_catalog.list_attribute("colors")}
        savers = {"categories": admin_catalog.save_category, "product-types": admin_catalog.save_product_type,
                  "sizes": lambda i, d, a: admin_catalog.save_attribute("sizes", i, d, a),
                  "colors": lambda i, d, a: admin_catalog.save_attribute("colors", i, d, a)}
        if method == "GET" and item_id is None:
            self.send_json({"success": True, "items": listers[kind]()})
            return True
        if (method == "POST" and item_id is None) or (method == "PUT" and item_id is not None):
            saved = savers[kind](item_id, data, actor_id)
            self.send_json({"success": True, "item": saved}, 201 if method == "POST" else 200)
            return True
        return False

    def route_admin_a7(self, method, path, params, data, actor_id):
        if path == "/api/admin/banners":
            if method == "GET":
                self.send_json({"success": True, "banners": admin_banners.list_banners()})
                return True
            if method == "POST":
                self.send_json({"success": True, "banner": admin_banners.create_banner(data, actor_id)}, 201)
                return True
        match = re.fullmatch(r"/api/admin/banners/(\d{1,10})(/status)?", path)
        if match:
            banner_id = int(match.group(1))
            if method == "GET" and not match.group(2):
                banner = admin_banners.get_banner(banner_id)
                if not banner:
                    raise admin_common.NotFoundError("Banner no encontrado.")
                self.send_json({"success": True, "banner": banner})
                return True
            if method == "PUT" and not match.group(2):
                self.send_json({"success": True, "banner": admin_banners.update_banner(banner_id, data, actor_id)})
                return True
            if method == "POST" and match.group(2):
                self.send_json({"success": True, "banner": admin_banners.set_banner_active(banner_id, data, actor_id)})
                return True
        if method == "GET" and path == "/api/admin/users":
            self.send_json({"success": True, **admin_users.list_users(params)})
            return True
        match = re.fullmatch(r"/api/admin/users/(\d{1,10})(/access)?", path)
        if match:
            user_id = int(match.group(1))
            if method == "GET" and not match.group(2):
                self.send_json({"success": True, "user": admin_users.get_user_detail(user_id)})
                return True
            if method == "POST" and match.group(2):
                self.send_json({"success": True, "user": admin_users.change_access(user_id, data, actor_id)})
                return True
        if method == "GET" and path == "/api/admin/audit":
            self.send_json({"success": True, **admin_audit.list_audit(params)})
            return True
        if method == "GET" and path == "/api/admin/pitcoins":
            self.send_json({"success": True, **admin_pitcoins.list_movements(params)})
            return True
        if method == "POST" and path == "/api/admin/pitcoins/adjust":
            payload, error, status = adjust_balance(data, actor_id)
            if error:
                self.send_error_json(error, status)
            else:
                self.send_json(payload, status)
            return True
        return False

    def route_admin_teams(self, method, path, params, data, actor_id):
        """Equipos y pilotos (A4). Devuelve True si la ruta se atendio."""
        for kind, getter, lister, creator, updater, activator in (
            ("teams", admin_teams.get_team, admin_teams.list_teams, admin_teams.create_team, admin_teams.update_team, admin_teams.set_team_active),
            ("drivers", admin_teams.get_driver, admin_teams.list_drivers, admin_teams.create_driver, admin_teams.update_driver, admin_teams.set_driver_active),
        ):
            key = kind[:-1]
            if path == f"/api/admin/{kind}":
                if method == "GET":
                    self.send_json({"success": True, **lister(params)})
                    return True
                if method == "POST":
                    self.send_json({"success": True, key: creator(data, actor_id)}, 201)
                    return True
            match = re.fullmatch(rf"/api/admin/{kind}/(\d{{1,10}})(/status)?", path)
            if match:
                item_id, action = int(match.group(1)), match.group(2)
                if method == "GET" and not action:
                    item = getter(item_id)
                    if not item:
                        raise admin_common.NotFoundError("Equipo no encontrado." if kind == "teams" else "Piloto no encontrado.")
                    self.send_json({"success": True, key: item})
                    return True
                if method == "PUT" and not action:
                    self.send_json({"success": True, key: updater(item_id, data, actor_id)})
                    return True
                if method == "POST" and action == "/status":
                    self.send_json({"success": True, key: activator(item_id, data, actor_id)})
                    return True
        if method == "GET" and path == "/api/admin/team-options":
            self.send_json({"success": True, "teams": admin_teams.team_options()})
            return True
        return False

    def route_admin_orders(self, method, path, params):
        """Pedidos y estadisticas (A6): solo lectura. Devuelve True si se atendio."""
        if method != "GET":
            return False
        if path == "/api/admin/orders":
            self.send_json({"success": True, **admin_orders.list_orders(params)})
            return True
        if path == "/api/admin/orders/stats":
            self.send_json({"success": True, "stats": admin_orders.get_order_stats(params)})
            return True
        match = re.fullmatch(r"/api/admin/orders/(\d{1,10})", path)
        if match:
            self.send_json({"success": True, "order": admin_orders.get_order(int(match.group(1)))})
            return True
        return False

    def route_admin_races(self, method, path, params, data, actor_id):
        """Carreras y liquidacion (A5). Devuelve True si la ruta se atendio."""
        if path == "/api/admin/bets" and method == "GET":
            self.send_json({"success": True, **admin_races.list_bets(params)})
            return True
        if path == "/api/admin/races":
            if method == "GET":
                self.send_json({"success": True, **admin_races.list_races(params)})
                return True
            if method == "POST":
                self.send_json({"success": True, "race": admin_races.create_race(data, actor_id)}, 201)
                return True
            return False
        match = re.fullmatch(r"/api/admin/races/(\d{1,10})(?:/(status|participants|settlement)(?:/(\d{1,10}))?)?", path)
        if not match:
            return False
        race_id, action, item = int(match.group(1)), match.group(2), match.group(3)
        if action is None and not item:
            if method == "GET":
                race = admin_races.get_race(race_id)
                if not race:
                    raise admin_common.NotFoundError("Carrera no encontrada.")
                self.send_json({"success": True, "race": race})
                return True
            if method == "PUT":
                self.send_json({"success": True, "race": admin_races.update_race(race_id, data, actor_id)})
                return True
        elif action == "status" and not item and method == "POST":
            self.send_json({"success": True, "race": admin_races.set_race_status(race_id, data, actor_id)})
            return True
        elif action == "participants":
            if method == "POST" and not item:
                self.send_json({"success": True, "race": admin_races.add_participants(race_id, data, actor_id)})
                return True
            if method == "DELETE" and item:
                self.send_json({"success": True, "race": admin_races.remove_participant(race_id, int(item), actor_id)})
                return True
        elif action == "settlement" and not item:
            if method == "GET":
                self.send_json({"success": True, "preview": admin_races.preview_settlement(race_id, params)})
                return True
            if method == "POST":
                self.send_json({"success": True, **admin_races.settle_race(race_id, data, actor_id)})
                return True
        return False

    def route_admin_products(self, method, path, params, data, actor_id):
        """Productos e inventario (A3). Devuelve True si la ruta se atendio."""
        if method == "GET" and path == "/api/admin/catalog":
            self.send_json({"success": True, "catalog": admin_products.get_catalog()})
            return True
        if method == "GET" and path == "/api/admin/images":
            self.send_json({"success": True, "images": uploads.list_images()})
            return True
        if path == "/api/admin/products":
            if method == "GET":
                self.send_json({"success": True, **admin_products.list_products(params)})
                return True
            if method == "POST":
                self.send_json({"success": True, "product": admin_products.create_product(data, actor_id)}, 201)
                return True
        match = re.fullmatch(r"/api/admin/products/(\d{1,10})(/flags|/variants)?", path)
        if match:
            product_id, action = int(match.group(1)), match.group(2)
            if method == "GET" and not action:
                product = admin_products.get_product(product_id)
                if not product:
                    raise admin_products.NotFoundError("Producto no encontrado.")
                self.send_json({"success": True, "product": product})
                return True
            if method == "PUT" and not action:
                self.send_json({"success": True, "product": admin_products.update_product(product_id, data, actor_id)})
                return True
            if method == "POST" and action == "/flags":
                self.send_json({"success": True, "product": admin_products.set_product_flags(product_id, data, actor_id)})
                return True
            if method == "POST" and action == "/variants":
                self.send_json({"success": True, "product": admin_products.create_variant(product_id, data, actor_id)}, 201)
                return True
        match = re.fullmatch(r"/api/admin/variants/(\d{1,10})(/stock)?", path)
        if match:
            variant_id, action = int(match.group(1)), match.group(2)
            if method == "PUT" and not action:
                self.send_json({"success": True, "product": admin_products.update_variant(variant_id, data, actor_id)})
                return True
            if method == "POST" and action == "/stock":
                self.send_json({"success": True, "product": admin_products.adjust_stock(variant_id, data, actor_id)})
                return True
        return False

    def handle_admin_upload(self):
        """Subida binaria de una imagen (no JSON). El permiso se valida antes de
        leer el cuerpo: sin sesion de staff no se recibe el archivo."""
        staff = self.require_staff()
        if not staff:
            return
        try:
            length = int(self.headers.get("Content-Length") or 0)
        except ValueError:
            return self.send_error_json("Solicitud inválida.", 400)
        if length <= 0:
            return self.send_error_json("Selecciona una imagen.", 400)
        if length > uploads.MAX_UPLOAD_BYTES:
            return self.send_error_json("La imagen supera el maximo de 2 MB.", 413)
        data = self.rfile.read(length)
        try:
            result = uploads.save_upload(data, self.headers.get("Content-Type"), staff["id"])
        except uploads.UploadError as exc:
            return self.send_error_json(str(exc), 400)
        return self.send_json({"success": True, **result}, 201)

    def route_get(self, path, params):
        if path.startswith("/api/admin/"):
            return self.route_admin("GET", path, params, {})
        if path == "/api/currencies":
            return self.send_json({"success": True, "base": currencies.BASE, "currencies": currencies.public_list()})
        if path == "/api/rewards":
            user = self.require_user()
            if not user:
                return
            return self.send_json({"success": True, "rewards": rewards.summary(user["id"])})
        if path == "/api/orders":
            user = self.require_user()
            if not user:
                return
            return self.send_json({"success": True, "orders": get_user_orders(user["id"])})
        if path == "/api/home":
            return self.send_json({"success": True, "home": get_home()})
        if path == "/api/banners":
            return self.send_json({"success": True, "banners": admin_banners.public_banners()})
        if path == "/api/auth/me":
            user = self.require_user()
            if not user:
                return
            # Permisos efectivos de la sesion (read_session), no la columna is_staff.
            profile = get_user(user["id"])
            if profile:
                profile = {**profile, "is_staff": user["is_staff"], "is_superadmin": user["is_superadmin"],
                           "password_change_required": user.get("password_change_required", False)}
            return self.send_json({"success": True, "user": profile})
        if path == "/api/products":
            return self.send_json({"success": True, "products": get_products(params)})
        if path == "/api/products/search":
            return self.send_json({"success": True, "products": search_products(params)})
        if path == "/api/products/filter":
            return self.send_json({"success": True, "products": filter_products(params)})
        if path.startswith("/api/products/"):
            product_id = int(path.rsplit("/", 1)[1])
            product = get_product_detail(product_id)
            if not product:
                return self.send_error_json("Producto no encontrado.", 404)
            return self.send_json({"success": True, "product": product})
        if path == "/api/categories":
            return self.send_json({"success": True, "categories": get_categories()})
        if path == "/api/teams":
            return self.send_json({"success": True, "teams": get_teams()})
        if path == "/api/sizes":
            return self.send_json({"success": True, "sizes": get_sizes()})
        if path == "/api/colors":
            return self.send_json({"success": True, "colors": get_colors()})
        if path == "/api/users":
            user = self.require_user()
            if not user:
                return
            if not user["is_staff"]:
                return self.send_error_json("Acceso restringido.", 403)
            return self.send_json({"success": True, "users": list_users()})
        if path.startswith("/api/users/"):
            actor = self.require_user()
            if not actor:
                return
            user_id = int(path.rsplit("/", 1)[1])
            if user_id != actor["id"] and not actor["is_staff"]:
                return self.send_error_json("Acceso restringido.", 403)
            user = get_user(user_id)
            if not user:
                return self.send_error_json("Usuario no encontrado.", 404)
            return self.send_json({"success": True, "user": user})
        if path == "/api/cart":
            user = self.require_user()
            if not user:
                return
            currency = (params.get("currency") or ["EUR"])[0]
            reward = (params.get("reward") or [None])[0]
            return self.send_json({"success": True, "cart": get_cart(user["id"], currency, reward)})
        if path == "/api/pitcoins/movements":
            user = self.require_user()
            if not user:
                return
            movements, total = get_movements(user["id"], list_limit(params, 100))
            return self.send_json({"success": True, "movements": movements, "total": total})
        if path == "/api/progress":
            if not progression.XP_ENABLED:
                return self.send_error_json("Ruta no encontrada.", 404)
            user = self.require_user()
            if not user:
                return
            progress = progression.get_progress(user["id"], list_limit(params, 50))
            if not progress:
                return self.send_error_json("Usuario no encontrado.", 404)
            return self.send_json({"success": True, "progress": progress})
        if path == "/api/avatar":
            user = self.require_user()
            if not user:
                return
            avatar = get_avatar(user["id"])
            if not avatar:
                return self.send_error_json("Usuario no encontrado.", 404)
            return self.send_json({"success": True, "avatar": avatar})
        if path == "/api/races":
            user = self.current_user()
            safe_params = {**params, "user_id": [user["id"] if user else 0]}
            return self.send_json({"success": True, "races": list_races(safe_params), "min_bet": settings.get("pitcoins.min_bet")})
        if path == "/api/races/leaderboard":
            return self.send_json({"success": True, "leaderboard": get_leaderboard()})
        if path.startswith("/api/races/"):
            race_id = int(path.rsplit("/", 1)[1])
            user = self.current_user()
            race = get_race_detail(race_id, user["id"] if user else 0)
            if not race:
                return self.send_error_json("Carrera no encontrada.", 404)
            return self.send_json({"success": True, "race": race})
        if path == "/api/bets":
            user = self.require_user()
            if not user:
                return
            return self.send_json({"success": True, "bets": get_user_bets(user["id"])})
        return self.send_error_json("Ruta no encontrada.", 404)

    def route_post(self, path, data):
        if path.startswith("/api/admin/"):
            return self.route_admin("POST", path, {}, data)
        if path == "/api/auth/logout":
            revoke_session(self.headers.get("Cookie"))
            self._session_cookie = clear_cookie()
            return self.send_json({"success": True})
        if path == "/api/auth/login":
            payload, error, status = login_user(data, self.client_ip())
            if error:
                return self.send_error_json(error, status)
            self._session_cookie = session_cookie(create_session(payload["user"]["id"]))
            return self.send_json(payload, status)
        if path == "/api/auth/forgot-password":
            payload, error, status = request_reset(data)
            return self.send_error_json(error, status) if error else self.send_json(payload, status)
        if path == "/api/auth/reset-password":
            payload, error, status = complete_reset(data)
            return self.send_error_json(error, status) if error else self.send_json(payload, status)
        if path in ("/api/users", "/api/auth/register"):
            payload, error, status = register_user(data)
            if error:
                return self.send_error_json(error, status)
            return self.send_json(payload, status)
        user = self.require_user()
        if not user:
            return
        data = {**data, "user_id": user["id"]}
        if path == "/api/pitcoins/adjust":
            if not user["is_superadmin"]:
                return self.send_error_json("Acceso restringido.", 403)
            payload, error, status = adjust_balance(data, user["id"])
            return self.send_error_json(error, status) if error else self.send_json(payload, status)
        if path.startswith("/api/races/") and path.endswith("/bet"):
            race_id = int(path.split("/")[3])
            payload, error, status = place_bet(race_id, data)
            if error:
                return self.send_error_json(error, status)
            return self.send_json(payload, status)
        # Abrir, cerrar, cancelar y liquidar carreras solo se hace desde el panel
        # (/api/admin/races/*): mismas transiciones, vista previa, confirmacion y
        # auditoria. Las antiguas /api/races/<id>/status y /result ya no existen.
        handlers = {
            "/api/auth/change-password": change_password,
            "/api/cart/add": add_to_cart,
            "/api/payments/simulate": simulate_payment,
            "/api/avatar/buy": buy_avatar_item,
        }
        handler = handlers.get(path)
        if not handler:
            return self.send_error_json("Ruta no encontrada.", 404)
        payload, error, status = handler(data)
        if error:
            return self.send_error_json(error, status)
        if path == "/api/auth/change-password":
            self._session_cookie = clear_cookie()
        return self.send_json(payload, status)

    def route_put(self, path, data):
        if path.startswith("/api/admin/"):
            return self.route_admin("PUT", path, {}, data)
        actor = self.require_user()
        if not actor:
            return
        if path.startswith("/api/users/"):
            user_id = int(path.rsplit("/", 1)[1])
            if user_id != actor["id"] and not actor["is_superadmin"]:
                return self.send_error_json("Acceso restringido.", 403)
            payload, error, status = update_user(user_id, data)
            if error:
                return self.send_error_json(error, status)
            return self.send_json(payload, status)
        if path == "/api/avatar":
            payload, error, status = save_avatar({**data, "user_id": actor["id"]})
            if error:
                return self.send_error_json(error, status)
            return self.send_json(payload, status)
        if path == "/api/cart/update":
            payload, error, status = update_cart_item({**data, "user_id": actor["id"]})
            if error:
                return self.send_error_json(error, status)
            return self.send_json(payload, status)
        return self.send_error_json("Ruta no encontrada.", 404)

    def route_delete(self, path, params, data):
        if path.startswith("/api/admin/"):
            return self.route_admin("DELETE", path, params, data)
        actor = self.require_user()
        if not actor:
            return
        if path.startswith("/api/users/"):
            user_id = int(path.rsplit("/", 1)[1])
            if user_id != actor["id"] and not actor["is_superadmin"]:
                return self.send_error_json("Acceso restringido.", 403)
            try:
                ok = admin_users.deactivate_legacy(user_id, actor["id"], data.get("version"))
            except admin_common.ConflictError as exc:
                return self.send_error_json(str(exc), 409)
            except admin_common.ValidationError as exc:
                return self.send_json({"success": False, "error": exc.message, "fields": exc.fields}, 400)
            if not ok:
                return self.send_error_json("Usuario no encontrado.", 404)
            return self.send_json({"success": True})
        if path == "/api/cart/remove":
            user_id = actor["id"]
            cart_item_id = int(data.get("cart_item_id") or data.get("item_id") or params.get("cart_item_id", [0])[0] or 0)
            if not user_id or not cart_item_id:
                return self.send_error_json("user_id y cart_item_id son obligatorios.")
            return self.send_json(remove_cart_item(user_id, cart_item_id))
        return self.send_error_json("Ruta no encontrada.", 404)


def check_progression_schema():
    """Con el XP activo el servidor no arranca sin las tablas de progresion."""
    if not progression.XP_ENABLED:
        print("Progresion XP: inactiva (PURPLE1_XP_ENABLED=0).", flush=True)
        return
    missing = progression.missing_schema()
    if missing:
        raise RuntimeError(
            "El XP esta activo pero falta " + ", ".join(missing)
            + ". Ejecuta database/upgrade.sql o desactiva el XP con PURPLE1_XP_ENABLED=0."
        )
    print("Progresion XP: activa.", flush=True)


def check_timezones():
    """Las carreras usan zonas IANA (Europe/Monaco...). En Windows Python no las
    trae: las aporta el paquete tzdata de requirements.txt."""
    try:
        ZoneInfo("Europe/Monaco")
    except ZoneInfoNotFoundError as exc:
        raise RuntimeError(
            "Faltan las zonas horarias de Python. Instala las dependencias con: "
            "python -m pip install -r requirements.txt"
        ) from exc


def run_server(host=HOST, port=PORT):
    if not FRONTEND_DIR.exists():
        print("No existe la carpeta frontend.", flush=True)
        return
    check_timezones()
    print("Probando conexion a MySQL...", flush=True)
    try:
        db_status = test_connection()
    except Exception as exc:
        print(f"Conexion MySQL fallida: {exc}", flush=True)
        raise
    print(
        "Conexion MySQL exitosa: "
        f"database={db_status['database']} version={db_status['version']} "
        f"host={db_status['config']['host']} user={db_status['config']['user']} "
        f"port={db_status['config']['port']}",
        flush=True,
    )
    check_progression_schema()
    server = HTTPServer((host, port), PurpleOneHandler)
    print("Servidor Python puro iniciado", flush=True)
    print(f"Frontend: http://{host}:{port}/index.html", flush=True)
    print(f"API: http://{host}:{port}/api/products", flush=True)
    server.serve_forever()
