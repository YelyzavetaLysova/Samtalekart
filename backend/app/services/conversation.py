from __future__ import annotations

from ..config import Settings
from ..models import ConversationMap, HelpRequest, MapNode


class ConversationService:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    async def suggest_map_update(self, current: ConversationMap, transcript: str) -> ConversationMap:
        # The first version is deliberately deterministic. The OpenAI provider
        # will later return the same schema without changing the route or UI.
        lowered = transcript.lower()
        candidates = [
            ("transport", "Transport", "Hvordan kommer dere dit?", ["buss", "gå", "holdeplass"]),
            ("cost", "Pris", "Hvor mye kan det koste?", ["gratis", "billett", "budsjett"]),
            ("weather", "Vær", "Hva gjør dere hvis været er dårlig?", ["regn", "inne", "plan B"]),
        ]
        existing = {node.id for node in current.nodes}
        for node_id, label, question, words in candidates:
            if node_id not in existing and any(word in lowered for word in words):
                updated = current.model_copy(deep=True)
                updated.nodes.append(
                    MapNode(
                        id=node_id,
                        label=label,
                        question=question,
                        words=words,
                        phrases=["Hva med ...?", "Vi kan også tenke på ..."],
                        tentative=True,
                    )
                )
                updated.version += 1
                return updated
        return current

    async def help_say(self, request: HelpRequest, node: MapNode | None) -> dict:
        label = node.label if node else "oppgaven"
        steps = [
            f"Tenk på hva du mener om {label.lower()}.",
            f"Hva er viktig når dere snakker om {label.lower()}?",
            "Du kan bruke: Jeg synes at ... fordi ...",
            "Nyttige ord: forslag, viktig, passer, kanskje.",
            "Start slik: Jeg synes at vi kan ...",
            "Eksempel: Jeg synes at vi kan velge dette fordi det passer for hele gruppen.",
        ]
        return {"level": request.level, "text": steps[request.level - 1], "max_level": len(steps)}

    async def help_understand(self, request: HelpRequest) -> dict:
        steps = [
            "Kan du si det en gang til?",
            "Kan du snakke litt saktere?",
            "Kan du forklare det med andre ord?",
            "Se etter nøkkelord i samtalekartet.",
            "Be om en kort forklaring på enkel norsk.",
            "Bruk oversettelse bare hvis de andre stegene ikke hjelper.",
        ]
        return {"level": request.level, "text": steps[request.level - 1], "max_level": len(steps)}

    async def feedback(self, participant_name: str) -> list[str]:
        return [
            f"{participant_name}, du ga en begrunnelse og hjalp gruppen videre.",
            "Du brukte uttrykket «jeg synes at» på en tydelig måte.",
            "Neste gang kan du stille ett oppfølgingsspørsmål til en annen deltaker.",
            "Nyttige uttrykk fra samtalen: en fordel er at, det passer fordi, hva synes du?",
        ]

