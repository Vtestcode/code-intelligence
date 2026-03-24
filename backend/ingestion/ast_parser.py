from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Dict, List

from tree_sitter import Language, Node, Parser
from tree_sitter_javascript import language as javascript_language
from tree_sitter_python import language as python_language

from config import get_settings

settings = get_settings()


@dataclass
class SymbolRecord:
    symbol: str
    symbol_type: str
    start_line: int
    end_line: int
    content: str
    docstring: str = ""
    calls: List[str] = field(default_factory=list)
    imports: List[str] = field(default_factory=list)


class ASTParser:
    def __init__(self) -> None:
        self.python_parser = Parser(Language(python_language()))
        self.javascript_parser = Parser(Language(javascript_language()))

    def parse_file(self, path: Path) -> Dict:
        source = path.read_text(encoding="utf-8", errors="ignore")
        parser = self.python_parser if path.suffix == ".py" else self.javascript_parser
        tree = parser.parse(source.encode("utf-8"))
        symbols = self._extract_symbols(tree.root_node, source, path.suffix)
        return {
            "path": str(path),
            "language": self._language_for_suffix(path.suffix),
            "content": source,
            "symbols": [s.__dict__ for s in symbols],
            "imports": sorted({imp for s in symbols for imp in s.imports}),
        }

    def _language_for_suffix(self, suffix: str) -> str:
        return "python" if suffix == ".py" else "javascript"

    def _extract_symbols(self, root: Node, source: str, suffix: str) -> List[SymbolRecord]:
        records: List[SymbolRecord] = []
        for child in root.children:
            if suffix == ".py":
                if child.type in {"function_definition", "class_definition"}:
                    records.append(self._record_python_symbol(child, source))
                elif child.type in {"import_statement", "import_from_statement"}:
                    imported = source[child.start_byte:child.end_byte].strip()
                    if records:
                        records[-1].imports.append(imported)
            else:
                if child.type in {"function_declaration", "class_declaration", "lexical_declaration"}:
                    record = self._record_js_symbol(child, source)
                    if record:
                        records.append(record)
                elif child.type == "import_statement":
                    imported = source[child.start_byte:child.end_byte].strip()
                    if records:
                        records[-1].imports.append(imported)
        return records

    def _record_python_symbol(self, node: Node, source: str) -> SymbolRecord:
        name_node = node.child_by_field_name("name")
        symbol = source[name_node.start_byte:name_node.end_byte] if name_node else "anonymous"
        block = source[node.start_byte:node.end_byte]
        calls = []
        for descendant in node.children:
            if descendant.type == "block":
                calls.extend(self._extract_simple_identifiers(descendant, source, {"call"}))
        return SymbolRecord(
            symbol=symbol,
            symbol_type="class" if node.type == "class_definition" else "function",
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            content=block[: settings.max_chunk_chars * 3],
            calls=sorted(set(calls)),
        )

    def _record_js_symbol(self, node: Node, source: str) -> SymbolRecord | None:
        name_node = node.child_by_field_name("name")
        if not name_node and node.type == "lexical_declaration":
            text = source[node.start_byte:node.end_byte]
            if "=>" not in text:
                return None
            symbol = text.split("=")[0].replace("const", "").replace("let", "").strip()
        else:
            symbol = source[name_node.start_byte:name_node.end_byte] if name_node else "anonymous"
        return SymbolRecord(
            symbol=symbol,
            symbol_type="class" if node.type == "class_declaration" else "function",
            start_line=node.start_point[0] + 1,
            end_line=node.end_point[0] + 1,
            content=source[node.start_byte:node.end_byte][: settings.max_chunk_chars * 3],
            calls=[],
            imports=[],
        )

    def _extract_simple_identifiers(self, node: Node, source: str, parent_types: set[str]) -> List[str]:
        values: List[str] = []
        stack = [node]
        while stack:
            current = stack.pop()
            stack.extend(current.children)
            if current.parent and current.parent.type in parent_types and current.type == "identifier":
                values.append(source[current.start_byte:current.end_byte])
        return values
