# SOL/USD · Sentiment Dashboard

Dashboard interactivo que acompaña el Trabajo Final de la Licenciatura en Ciencias de Datos
(Universidad Católica de Salta): **¿aportan los indicadores de sentimiento poder predictivo
sobre la dirección del precio de Solana?**

La respuesta corta, y el resultado central de la tesina, es **no**. El dashboard muestra esa
comparación de forma reproducible: modelos XGBoost entrenados con y sin features de
sentimiento, evaluados sobre exactamente los mismos días de test, con el test de McNemar como
contraste formal.

---

## Stack

| Capa | Herramientas |
|---|---|
| Frontend | Next.js 14 (App Router) · TypeScript · Tailwind CSS · **Apache ECharts** |
| Modelos | XGBoost (clasificador de dirección + regresor de retornos) |
| Sentimiento | `cardiffnlp/twitter-roberta-base-sentiment-latest` sobre posts de r/Solana |
| Fuentes | Yahoo Finance (precios) · Reddit vía PRAW · Alternative.me (Fear & Greed Index) |
| Automatización | GitHub Actions (cron diario 06:00 UTC) |
| Hosting | Vercel |

---

## Estructura

```
.
├── app/                        # Next.js App Router
│   ├── components/
│   │   ├── Dashboard.tsx       # UI completa + opciones de ECharts
│   │   ├── EChart.tsx          # wrapper de echarts.init() con ResizeObserver
│   │   └── ThemeProvider.tsx   # contexto de tema + paletas + toggle
│   ├── globals.css             # tokens de tema (claro/oscuro) y utilidades
│   ├── layout.tsx              # anti-flash de tema antes del primer paint
│   └── page.tsx                # lee public/data/dashboard_data.json
│
├── pipeline/                   # Todo el Python
│   ├── _paths.py               # rutas resueltas desde la raíz del repo
│   ├── get_prices.py           # precios SOL/USD (yfinance)
│   ├── get_reddit.py           # posts recientes de r/Solana
│   ├── get_reddit_extended.py  # scraping histórico ampliado
│   ├── get_fear_greed.py       # Crypto Fear & Greed Index
│   ├── sentiment.py            # inferencia RoBERTa sobre los posts
│   ├── export_for_dashboard.py # entrena, evalúa y exporta el JSON
│   └── requirements.txt
│
├── data/                       # CSVs versionados (el cron los actualiza)
├── public/data/
│   └── dashboard_data.json     # única entrada del frontend
└── .github/workflows/
    └── daily_update.yml        # cron diario
```

El frontend nunca ejecuta Python: sólo lee `public/data/dashboard_data.json`. Eso mantiene el
deploy de Vercel liviano y hace que la web siga funcionando aunque el pipeline falle un día.

---

## Desarrollo local

### Frontend

```bash
npm install
npm run dev          # http://localhost:3000
```

### Pipeline

```bash
python -m venv venv && source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r pipeline/requirements.txt
cp .env.example .env                              # completá las credenciales de Reddit
```

Los scripts resuelven sus rutas desde la raíz del repo, así que podés correrlos desde donde
quieras. El orden importa: primero los que traen datos, después el sentimiento, y al final el
export.

```bash
python pipeline/get_prices.py
python pipeline/get_reddit_extended.py
python pipeline/get_fear_greed.py
python pipeline/sentiment.py
python pipeline/export_for_dashboard.py
```

Ese último regenera `public/data/dashboard_data.json`. Refrescá el navegador y listo.

> `sentiment.py` descarga el modelo RoBERTa (~500 MB) la primera vez y necesita `torch`.
> Es de lejos el paso más lento.

---

## Deploy en Vercel

El repo está armado para que Vercel lo detecte solo: la app Next.js vive en la raíz, no hace
falta `vercel.json` ni configurar Root Directory.

1. En Vercel, **Add New → Project** e importá el repositorio de GitHub.
2. Framework: Next.js (autodetectado). Build command y output directory: dejalos por defecto.
3. Deploy.

No hay variables de entorno que configurar en Vercel: las credenciales de Reddit las usa el
pipeline, no el frontend.

Cada push a `main` dispara un redeploy. Como el cron commitea el JSON actualizado, el
dashboard se refresca solo todos los días.

---

## Secrets de GitHub Actions

En **Settings → Secrets and variables → Actions**, cargá:

| Secret | De dónde sale |
|---|---|
| `REDDIT_CLIENT_ID` | app de tipo *script* en reddit.com/prefs/apps |
| `REDDIT_CLIENT_SECRET` | ídem |
| `REDDIT_USER_AGENT` | string libre, ej. `sol-sentiment-bot/1.0 by u/tu_usuario` |

Precios y Fear & Greed no requieren credenciales.

Antes de confiar en el cron, corré el workflow a mano una vez desde la pestaña **Actions →
Daily Pipeline Update → Run workflow**: es la forma más rápida de ver si los secrets quedaron
bien.

---

## Qué mira el dashboard

- **Precio real, test set y forecast a 7 días** — predicciones superpuestas sobre la serie real,
  con marcas del corte train/test y del día de hoy.
- **Análisis estadístico** — correlaciones sentimiento↔retorno (mismo día, día siguiente, lag 1)
  y accuracy naive por fuente.
- **Clasificador de dirección** — accuracy, precision, recall, F1 y AUC de los cuatro modelos
  (baseline, +Reddit, +Fear & Greed, +Combinado) sobre los mismos días, más los tests de McNemar.
- **Regresor** — MAE, RMSE y R² en el mismo esquema de comparación justa.
- **Fuentes de sentimiento** — serie diaria de Reddit contra precio normalizado, Fear & Greed
  Index por rangos, y los posts con más score.

El toggle de la esquina superior derecha alterna modo claro/oscuro. La preferencia queda
guardada en `localStorage` y, la primera vez, respeta el `prefers-color-scheme` del sistema.

---

## Notas metodológicas

Tres decisiones que condicionan cómo se leen los resultados:

- **Sin look-ahead.** Las features de sentimiento van con `.shift(1)`: el sentimiento de ayer
  predice el retorno de mañana. Usar el sentimiento del mismo día filtraba información futura e
  inflaba artificialmente las métricas.
- **Se predicen retornos, no precios.** Predecir el precio absoluto hacía que el modelo arrastrara
  el nivel del período de entrenamiento. El precio que se grafica se reconstruye a partir del
  retorno predicho.
- **Comparación justa.** Los modelos con sentimiento sólo tienen datos en los días con cobertura
  de Reddit (≥5 posts), así que se evalúan todos sobre la intersección de días. Comparar cada
  modelo en su propio test set haría que las métricas no fueran comparables entre sí.

---

## Licencia

Trabajo académico. Código disponible para consulta y reutilización con atribución.
