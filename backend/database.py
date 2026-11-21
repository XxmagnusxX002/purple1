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
import threading
from contextlib import contextmanager

import mysql.connector
from mysql.connector import Error, pooling
from mysql.connector.errors import PoolError


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


# Pool de conexiones: abrir una conexion nueva por consulta cuesta varias idas y
# vueltas de red (TCP, TLS y autenticacion). Con la base en la nube eso hacia que
# cada pagina tardara segundos. El pool reutiliza conexiones ya abiertas; al
# devolverlas se reinicia la sesion, asi ninguna transaccion queda colgada.
POOL_SIZE = max(1, min(32, int(os.getenv("PURPLE1_DB_POOL_SIZE", "8"))))
_pool = None
_pool_lock = threading.Lock()


def _connection_config():
    return {**DB_CONFIG, "host": _clean_host(DB_CONFIG.get("host")), "connection_timeout": 5}


def _get_pool():
    global _pool
    if _pool is None:
        with _pool_lock:
            if _pool is None:
                _pool = pooling.MySQLConnectionPool(
                    pool_name="purple1", pool_size=POOL_SIZE, pool_reset_session=True, **_connection_config()
                )
    return _pool


# Conexion compartida por peticion (solo lecturas GET): las consultas de una
# misma peticion usan una conexion en lugar de pedir una al pool cada vez.
_local = threading.local()


@contextmanager
def request_scope():
    _local.active = True
    _local.connection = None
    try:
        yield
    finally:
        connection = getattr(_local, "connection", None)
        _local.active = False
        _local.connection = None
        if connection is not None:
            try:
                connection.rollback()
            except Error:
                pass
            try:
                connection.close()
            except Error:
                pass


def get_connection():
    if getattr(_local, "active", False):
        if _local.connection is None:
            _local.connection = _open_connection()
        return _local.connection
    return _open_connection()


def _open_connection():
    if DB_CONFIG["password"] is None:
        raise RuntimeError("Falta la contrasena de MySQL: ejecuta python main.py o define PURPLE1_DB_PASSWORD.")
    config = _connection_config()
    try:
        try:
            return _get_pool().get_connection()
        except PoolError:
            # Todas las conexiones del pool estan ocupadas: se abre una aparte.
            return mysql.connector.connect(**config)
    except Error as exc:
        safe_config = dict(config)
        safe_config["password"] = "***"
        raise RuntimeError(f"No se pudo conectar a MySQL con {safe_config}: {exc}") from exc


def close_connection(connection=None, cursor=None):
    if cursor is not None:
        try:
            cursor.close()
        except Error:
            pass
    if connection is not None and connection is getattr(_local, "connection", None):
        return  # la devuelve request_scope al terminar la peticion
    if connection is not None:
        # En una conexion del pool, close() la devuelve al pool (no la cierra).
        try:
            connection.close()
        except Error:
            pass


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
