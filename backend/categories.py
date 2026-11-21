from database import fetch_all
from utils import image_path


def get_categories():
    return fetch_all("SELECT id, name, slug, parent_id, description FROM categories WHERE is_active = TRUE AND parent_id IS NULL ORDER BY display_order, name")


def get_teams():
    """Escuderias activas con su monoplaza, escudo, colores y pilotos titulares."""
    teams = fetch_all("""SELECT id, name, slug, description, country, primary_color, secondary_color, logo_path, image_path
                         FROM teams WHERE is_active = TRUE ORDER BY name""")
    drivers = fetch_all("SELECT team_id, name, number FROM drivers WHERE is_active = TRUE ORDER BY number")
    for team in teams:
        team["logo_path"] = image_path(team["logo_path"])
        team["image_path"] = image_path(team["image_path"])
        team["drivers"] = [{"name": d["name"], "number": d["number"]} for d in drivers if d["team_id"] == team["id"]]
    return teams


def get_sizes():
    return fetch_all("SELECT id, name, visual_order FROM sizes WHERE is_active = TRUE ORDER BY visual_order, name")


def get_colors():
    return fetch_all("SELECT id, name, hex_code FROM colors WHERE is_active = TRUE ORDER BY name")

