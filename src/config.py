"""Shared paths and settings. Values come from .env (see .env.example)."""
import os
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DATA_DIR = ROOT / "data"
RAW_DIR = DATA_DIR / "raw"
PROCESSED_DIR = DATA_DIR / "processed"
LABELS_DIR = DATA_DIR / "labels"
TAXONOMY_DIR = DATA_DIR / "taxonomies"
APP_DIR = DATA_DIR / "app"
for d in (RAW_DIR, PROCESSED_DIR, LABELS_DIR, TAXONOMY_DIR, APP_DIR):
    d.mkdir(parents=True, exist_ok=True)

# ---- datasets -------------------------------------------------------------
# Every dataset is turned into one sample file with the same columns:
#   review_id, dataset, market, platform, category, group_id, rating, human_label, title, text
# group_id = the unit we summarize by (a product on Amazon, a category on JD).
DATASETS = {
    "jd": {
        "name": "JD.com (China), 6 product categories",
        "market": "domestic",
        "language": "zh",
        "group_by": "category",
        "has_human_label": True,
    },
    "amazon_tea": {
        "name": "Amazon US, tea products",
        "market": "overseas",
        "language": "en",
        "group_by": "product",
        "has_human_label": False,
    },
}


def sample_file(dataset: str) -> Path:
    return PROCESSED_DIR / f"{dataset}_sample.csv"


def labels_file(dataset: str) -> Path:
    return LABELS_DIR / f"{dataset}.jsonl"


def app_dir(dataset: str) -> Path:
    d = APP_DIR / dataset
    d.mkdir(parents=True, exist_ok=True)
    return d


# Amazon Fine Food Reviews (SNAP, McAuley & Leskovec 2013), parquet mirror on Hugging Face
AMAZON_URL = (
    "https://huggingface.co/api/datasets/jhan21/amazon-food-reviews-dataset"
    "/parquet/default/train/0.parquet"
)
AMAZON_RAW = RAW_DIR / "fine_food_reviews.parquet"
TEA_REVIEWS_FILE = PROCESSED_DIR / "tea_reviews.parquet"

# online_shopping_10_cats (ChineseNlpCorpus), JD.com reviews with human pos/neg labels
JD_URL = (
    "https://raw.githubusercontent.com/SophonPlus/ChineseNlpCorpus/master"
    "/datasets/online_shopping_10_cats/online_shopping_10_cats.zip"
)
JD_RAW = RAW_DIR / "online_shopping_10_cats.zip"

# ---- LLM settings ---------------------------------------------------------
PROVIDER = os.getenv("LLM_PROVIDER", "gemini").lower()
GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")
GEMINI_MODEL = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite")
GEMINI_FALLBACK_MODELS = [
    m.strip() for m in os.getenv("GEMINI_FALLBACK_MODELS", "gemini-flash-lite-latest,gemini-3.8-flash").split(",")
    if m.strip()
]
DEEPSEEK_API_KEY = os.getenv("DEEPSEEK_API_KEY", "")
DEEPSEEK_MODEL = os.getenv("DEEPSEEK_MODEL", "deepseek-chat")
REQUESTS_PER_MINUTE = float(os.getenv("REQUESTS_PER_MINUTE", "14"))
BATCH_SIZE = int(os.getenv("BATCH_SIZE", "20"))
