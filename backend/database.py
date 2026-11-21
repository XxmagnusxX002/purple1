"""Conexion a MySQL.

Valores por defecto pensados para MySQL Workbench en local (Local instance):
host 127.0.0.1, puerto 3306, usuario root y base purple1. Cualquiera se puede
cambiar con una variable de entorno (PURPLE1_DB_HOST, PURPLE1_DB_PORT,
PURPLE1_DB_USER, PURPLE1_DB_NAME).

La contrasena nunca se escribe en el codigo: se toma de PURPLE1_DB_PASSWORD o,
si no existe, main.py la pide por consola al arrancar (ask_password_if_missing).
"""

import getpass
import os
import sys
from contextlib import contextmanager

import mysql.connector
from mysql.connector import Error


def _clean_host(host):
    value = (host or "127.0.0.1").strip()
    if value.lower() == "localhost":
        return "127.0.0.1"
    return value


DB_CONFIG = {
    "host": _clean_host(os.getenv("PURPLE1_DB_HOST", "127.0.0.1")),
    "port": int(os.getenv("PURPLE1_DB_PORT", "3306")),
    "user": os.getenv("PURPLE1_DB_USER", "root").strip() or "root",
    "password": os.getenv("PURPLE1_DB_PASSWORD"),  # None = todavia no indicada
    "database": os.getenv("PURPLE1_DB_NAME", "purple1").strip() or "purple1",
}


def ask_password_if_missing():
    """Pide la contrasena de MySQL por consola si no vino en PURPLE1_DB_PASSWORD."""
    if DB_CONFIG["password"] is not None:
        return
    if not sys.stdin or not sys.stdin.isatty():
        raise RuntimeError(
            "Falta la contrasena de MySQL. Ejecuta python main.py en una consola para escribirla "
            "o define la variable PURPLE1_DB_PASSWORD."
        )
    DB_CONFIG["password"] = getpass.getpass(
        f"Contrasena de MySQL para {DB_CONFIG['user']}@{DB_CONFIG['host']}:{DB_CONFIG['port']} "
        f"(base {DB_CONFIG['database']}): "
    )


ER_DUP_ENTRY = 1062


def is_duplicate_key(exc):
    return isinstance(exc, Error) and getattr(exc, "errno", None) == ER_DUP_ENTRY


def get_connection():
    if DB_CONFIG["password"] is None:
        raise RuntimeError("Falta la contrasena de MySQL: ejecuta python main.py o define PURPLE1_DB_PASSWORD.")
    config = {**DB_CONFIG, "host": _clean_host(DB_CONFIG.get("host"))}
    try:
        return mysql.connector.connect(**config, connection_timeout=5)
    except Error as exc:
        safe_config = dict(config)
        safe_config["password"] = "***"
        raise RuntimeError(f"No se pudo conectar a MySQL con {safe_config}: {exc}") from exc


def close_connection(connection=None, cursor=None):
    if cursor is not None:
        cursor.close()
    if connection is not None and connection.is_connected():
        connection.close()


@contextmanager
def db_cursor(dictionary=True):
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor(dictionary=dictionary)
        yield connection, cursor
    except Exception as exc:
        if connection:
            connection.rollback()
        if isinstance(exc, Error):
            raise RuntimeError(f"Error de base de datos: {exc}") from exc
        raise
    finally:
        close_connection(connection, cursor)


def fetch_all(sql, params=()):
    with db_cursor(dictionary=True) as (_, cursor):
        cursor.execute(sql, params)
        return cursor.fetchall()


def fetch_one(sql, params=()):
    rows = fetch_all(sql, params)
    return rows[0] if rows else None


def execute_query(sql, params=()):
    with db_cursor(dictionary=True) as (connection, cursor):
        cursor.execute(sql, params)
        connection.commit()
        return {"lastrowid": cursor.lastrowid, "rowcount": cursor.rowcount}


def test_connection():
    connection = None
    cursor = None
    try:
        connection = get_connection()
        cursor = connection.cursor()
        cursor.execute("SELECT DATABASE(), VERSION()")
        database_name, version = cursor.fetchone()
        return {
            "success": True,
            "database": database_name,
            "version": version,
            "config": {**DB_CONFIG, "host": _clean_host(DB_CONFIG.get("host")), "password": "***"},
        }
    finally:
        close_connection(connection, cursor)
