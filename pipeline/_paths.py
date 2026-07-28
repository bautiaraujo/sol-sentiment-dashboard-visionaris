"""
Rutas del proyecto, resueltas desde la ubicación de este archivo.
Así los scripts funcionan igual si los corrés desde la raíz del repo,
desde pipeline/, o desde un runner de GitHub Actions.
"""
from pathlib import Path

ROOT        = Path(__file__).resolve().parents[1]
DATA        = ROOT / "data"                 # CSVs crudos y procesados
PUBLIC_DATA = ROOT / "public" / "data"      # JSON que consume el dashboard

DATA.mkdir(parents=True, exist_ok=True)
PUBLIC_DATA.mkdir(parents=True, exist_ok=True)
