from pathlib import Path
import sys

BASE_DIR = Path(__file__).resolve().parent
BACKEND_DIR = BASE_DIR / "backend"
sys.path.insert(0, str(BACKEND_DIR))

from database import ask_password_if_missing
from server import run_server


if __name__ == "__main__":
    try:
        ask_password_if_missing()
        run_server()
    except KeyboardInterrupt:
        print("\nServidor detenido.")
    except RuntimeError as exc:
        print(f"\nNo se pudo iniciar Purple One: {exc}")
        sys.exit(1)
