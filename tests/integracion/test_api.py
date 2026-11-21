"""Pruebas de integración de Purple One.

Prueban el sistema completo de punta a punta: navegador -> Vercel -> Render
(Python) -> MySQL en Railway. No usan el código por dentro: hacen peticiones
HTTP reales, como el navegador, y revisan los códigos y mensajes del contrato
(docs/contratos/api.md).

Cómo correrlas (solo librería estándar de Python, sin instalar nada):
    python -m unittest discover -s tests/integracion -v
Contra otro servidor (por ejemplo el local):
    PURPLE1_BASE_URL=http://127.0.0.1:8000 python -m unittest discover -s tests/integracion -v

Crean un usuario de prueba con correo qa-<fecha>@purpleone.test y al final lo
desactivan (no se borra nada: así funciona Purple One).
"""

import json
import os
import time
import unittest
import urllib.error
import urllib.request
from http.cookiejar import CookieJar

BASE_URL = os.getenv("PURPLE1_BASE_URL", "https://purple1-seven.vercel.app").rstrip("/")
TIMEOUT = 90  # el plan gratis de Render puede tardar ~1 min en despertar


class Cliente:
    """Un navegador mínimo: guarda la cookie de sesión y manda el Origin del sitio."""

    def __init__(self, origin=BASE_URL):
        self.origin = origin
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(CookieJar()))

    def pedir(self, metodo, ruta, datos=None):
        cuerpo = json.dumps(datos).encode() if datos is not None else None
        req = urllib.request.Request(BASE_URL + ruta, data=cuerpo, method=metodo)
        req.add_header("Accept", "application/json")
        if cuerpo is not None:
            req.add_header("Content-Type", "application/json")
        if metodo != "GET":
            req.add_header("Origin", self.origin)
        try:
            with self.opener.open(req, timeout=TIMEOUT) as resp:
                texto = resp.read().decode()
                return resp.status, _json(texto), resp.geturl()
        except urllib.error.HTTPError as err:
            return err.code, _json(err.read().decode()), err.geturl()


def _json(texto):
    try:
        return json.loads(texto)
    except ValueError:
        return {"_texto": texto[:200]}


def setUpModule():
    # Despierta el back antes de medir nada.
    Cliente().pedir("GET", "/api/currencies")


class CatalogoPublico(unittest.TestCase):
    def test_monedas_activas(self):
        estado, datos, _ = Cliente().pedir("GET", "/api/currencies")
        self.assertEqual(estado, 200)
        codigos = {m["code"] for m in datos["currencies"]}
        self.assertIn("EUR", codigos)
        self.assertIn("COP", codigos)

    def test_catalogo_trae_productos_de_la_base(self):
        estado, datos, _ = Cliente().pedir("GET", "/api/products?sort=recent")
        self.assertEqual(estado, 200)
        self.assertGreater(len(datos["products"]), 0)
        self.assertIn("final_price", datos["products"][0])

    def test_busqueda_resiste_inyeccion_sql(self):
        estado, datos, _ = Cliente().pedir("GET", "/api/products/search?q=%27%20OR%201%3D1%20--")
        self.assertEqual(estado, 200)
        self.assertEqual(datos["products"], [])

    def test_producto_inexistente_da_404(self):
        estado, datos, _ = Cliente().pedir("GET", "/api/products/999999")
        self.assertEqual(estado, 404)
        self.assertFalse(datos["success"])

    def test_carreras_y_ranking_sin_correos(self):
        estado, datos, _ = Cliente().pedir("GET", "/api/races")
        self.assertEqual(estado, 200)
        self.assertGreater(len(datos["races"]), 0)
        estado, datos, _ = Cliente().pedir("GET", "/api/races/leaderboard")
        self.assertEqual(estado, 200)
        self.assertNotIn("@", json.dumps(datos["leaderboard"]))


class Seguridad(unittest.TestCase):
    def test_carrito_sin_sesion_da_401(self):
        estado, datos, _ = Cliente().pedir("GET", "/api/cart")
        self.assertEqual(estado, 401)
        self.assertEqual(datos["error"], "Inicia sesión para continuar.")

    def test_api_del_panel_sin_sesion_da_401(self):
        estado, _, _ = Cliente().pedir("GET", "/api/admin/users")
        self.assertEqual(estado, 401)

    def test_pagina_del_panel_manda_al_login(self):
        _, _, url_final = Cliente().pedir("GET", "/admin/users.html")
        self.assertIn("/admin/login.html", url_final)

    def test_origen_ajeno_da_403(self):
        estado, datos, _ = Cliente(origin="https://sitio-ajeno.example").pedir(
            "POST", "/api/auth/login", {"email": "x@x.com", "password": "x"})
        self.assertEqual(estado, 403)
        self.assertEqual(datos["error"], "Origen no permitido.")

    def test_contrasena_corta_da_400(self):
        estado, datos, _ = Cliente().pedir("POST", "/api/auth/register", {
            "first_name": "QA", "last_name": "Corta", "email": f"qa-corta-{int(time.time())}@purpleone.test",
            "password": "abc123", "password_confirm": "abc123"})
        self.assertEqual(estado, 400)
        self.assertFalse(datos["success"])


class RecorridoDeUnCliente(unittest.TestCase):
    """Registro -> login -> datos propios -> reglas de PitCoins -> cerrar sesión."""

    @classmethod
    def setUpClass(cls):
        cls.cliente = Cliente()
        cls.email = f"qa-{int(time.time())}@purpleone.test"
        cls.password = "PruebaQA2026!"
        cls.user_id = None

    @classmethod
    def tearDownClass(cls):
        if cls.user_id:
            cls.cliente.pedir("DELETE", f"/api/users/{cls.user_id}", {})

    def test_1_registro_crea_cuenta_con_1000_pitcoins(self):
        estado, datos, _ = self.cliente.pedir("POST", "/api/auth/register", {
            "first_name": "QA", "last_name": "Integración", "email": self.email,
            "password": self.password, "password_confirm": self.password})
        self.assertEqual(estado, 201, datos)
        type(self).user_id = datos["user"]["id"]
        self.assertEqual(datos["user"]["coins"], 1000)
        self.assertNotIn("password_hash", datos["user"])

    def test_2_correo_repetido_da_400(self):
        estado, datos, _ = self.cliente.pedir("POST", "/api/auth/register", {
            "first_name": "QA", "last_name": "Repetido", "email": self.email,
            "password": self.password, "password_confirm": self.password})
        self.assertEqual(estado, 400)
        self.assertEqual(datos["error"], "Ya existe una cuenta con ese correo.")

    def test_3_contrasena_incorrecta_da_401(self):
        estado, _, _ = Cliente().pedir("POST", "/api/auth/login", {"email": self.email, "password": "otra-clave-123"})
        self.assertEqual(estado, 401)

    def test_4_login_y_sesion(self):
        estado, datos, _ = self.cliente.pedir("POST", "/api/auth/login", {"email": self.email, "password": self.password})
        self.assertEqual(estado, 200, datos)
        estado, datos, _ = self.cliente.pedir("GET", "/api/auth/me")
        self.assertEqual(estado, 200)
        self.assertEqual(datos["user"]["email"], self.email)

    def test_5_carrito_propio_vacio(self):
        estado, datos, _ = self.cliente.pedir("GET", "/api/cart?currency=COP")
        self.assertEqual(estado, 200, datos)

    def test_6_no_puede_ver_datos_de_otro_usuario(self):
        otro = 1 if self.user_id != 1 else 2
        estado, _, _ = self.cliente.pedir("GET", f"/api/users/{otro}")
        self.assertIn(estado, (403, 404))

    def test_7_pronostico_bajo_el_minimo_da_400(self):
        _, datos, _ = self.cliente.pedir("GET", "/api/races?status=OPEN")
        abiertas = [r for r in datos.get("races", []) if not r.get("betting_closed") and r.get("options")]
        if not abiertas:
            self.skipTest("No hay carreras abiertas para pronosticar.")
        carrera = abiertas[0]
        estado, datos, _ = self.cliente.pedir(
            "POST", f"/api/races/{carrera['id']}/bet", {"option_id": carrera["options"][0]["id"], "amount": 1})
        self.assertEqual(estado, 400)
        self.assertIn("mínimo", datos["error"])

    def test_8_cerrar_sesion(self):
        estado, _, _ = self.cliente.pedir("POST", "/api/auth/logout", {})
        self.assertEqual(estado, 200)
        estado, _, _ = self.cliente.pedir("GET", "/api/auth/me")
        self.assertEqual(estado, 401)
        # Para desactivar la cuenta de prueba en tearDownClass hace falta sesión.
        self.cliente.pedir("POST", "/api/auth/login", {"email": self.email, "password": self.password})


if __name__ == "__main__":
    unittest.main(verbosity=2)
