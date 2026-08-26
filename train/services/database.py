"""SQLite database bootstrap for the dashboard's main clinics table."""
from __future__ import annotations

import sqlite3
from pathlib import Path

import pandas as pd

from services.paths import TABLE_NAME


def load_source_dataframe(csv_path: Path) -> pd.DataFrame:
    if not csv_path.exists():
        raise FileNotFoundError(
            f"Required source file not found: {csv_path.name}. The server must load this CSV at startup."
        )

    dataframe = pd.read_csv(csv_path)
    if dataframe.empty:
        raise ValueError("golden_executive_record.csv is empty.")
    return dataframe


def initialize_database(csv_path: Path) -> sqlite3.Connection:
    dataframe = load_source_dataframe(csv_path)
    connection = sqlite3.connect(":memory:", check_same_thread=False)
    connection.row_factory = sqlite3.Row
    dataframe.to_sql(TABLE_NAME, connection, index=False, if_exists="replace")
    return connection
