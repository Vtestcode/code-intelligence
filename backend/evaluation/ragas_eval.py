from __future__ import annotations

from typing import Any, Dict, List

import pandas as pd
from datasets import Dataset
from ragas import evaluate
from ragas.metrics import answer_relevancy, context_precision, context_recall, faithfulness

from services import get_embeddings, get_llm


class RagasEvaluator:
    def __init__(self) -> None:
        self.llm = get_llm()
        self.embeddings = get_embeddings()

    def run(self, rows: List[Dict[str, Any]]) -> Dict[str, Any]:
        dataset = Dataset.from_pandas(pd.DataFrame(rows))
        result = evaluate(
            dataset,
            metrics=[faithfulness, answer_relevancy, context_precision, context_recall],
            llm=self.llm,
            embeddings=self.embeddings,
        )
        return result.to_pandas().to_dict(orient="records")
