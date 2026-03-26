import random
import time
from typing import List, Optional, TypedDict

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


class ParticipantRecord(TypedDict, total=False):
    name: str
    carId: Optional[str]
    carLabel: Optional[str]


app = FastAPI(title="Sorteio API", version="1.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParticipantPayload(BaseModel):
    name: str
    carId: Optional[str] = None
    carLabel: Optional[str] = None


class DrawPayload(BaseModel):
    count: int = 1


class PurgePayload(BaseModel):
    admin_name: str


participants: List[ParticipantRecord] = []
winners: List[str] = []
race_started_at: Optional[int] = None


def participant_name(participant: ParticipantRecord | str) -> str:
    if isinstance(participant, str):
        return participant
    return participant.get("name", "")


def serialize_participant(participant: ParticipantRecord | str) -> ParticipantRecord:
    if isinstance(participant, str):
        return {
            "name": participant,
            "carId": None,
            "carLabel": None,
        }

    return {
        "name": participant.get("name", ""),
        "carId": participant.get("carId"),
        "carLabel": participant.get("carLabel"),
    }


def build_state():
    return {
        "participants": [serialize_participant(participant) for participant in participants],
        "winners": winners,
        "raceStartAt": race_started_at,
    }


@app.get("/participants")
def list_participants():
    return build_state()


@app.post("/participants", status_code=201)
def add_participant(payload: ParticipantPayload):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome e obrigatorio.")

    normalized = name.lower()
    for index, registered in enumerate(participants):
        if participant_name(registered).lower() != normalized:
            continue

        updated = serialize_participant(registered)
        updated["name"] = participant_name(registered) or name
        updated["carId"] = payload.carId if payload.carId is not None else updated.get("carId")
        updated["carLabel"] = (
            payload.carLabel if payload.carLabel is not None else updated.get("carLabel")
        )
        participants[index] = updated
        return build_state()

    participants.append(
        {
            "name": name,
            "carId": payload.carId,
            "carLabel": payload.carLabel,
        }
    )
    return build_state()


@app.post("/draw")
def draw_winner(payload: DrawPayload):
    if not participants:
        raise HTTPException(
            status_code=400,
            detail="Nao ha participantes para o sorteio.",
        )

    count = max(1, payload.count)
    if count > len(participants):
        raise HTTPException(
            status_code=400,
            detail="Quantidade de ganhadores maior que o numero de participantes.",
        )

    global winners, race_started_at
    race_started_at = int(time.time() * 1000)
    pool = [participant_name(participant) for participant in participants]
    winners = random.sample(pool, count)
    return {"winners": winners, "raceStartAt": race_started_at}


@app.post("/winner/reset")
def reset_winner():
    global winners, race_started_at
    winners = []
    race_started_at = None
    return {"winners": winners, "raceStartAt": race_started_at}


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "totalParticipants": len(participants),
        "winners": winners,
        "raceStartAt": race_started_at,
    }


@app.delete("/participants/{name}")
def delete_participant(name: str):
    normalized = name.strip().lower()
    if not normalized:
        raise HTTPException(status_code=400, detail="Nome invalido.")

    global winners
    removed = False
    remaining: List[ParticipantRecord] = []
    for participant in participants:
        if participant_name(participant).lower() == normalized and not removed:
            removed = True
            continue
        remaining.append(serialize_participant(participant))

    if not removed:
        raise HTTPException(status_code=404, detail="Participante nao encontrado.")

    participants.clear()
    participants.extend(remaining)

    winners = [winner for winner in winners if winner.lower() != normalized]

    return build_state()


@app.post("/participants/purge")
def purge_participants(payload: PurgePayload):
    admin_name = payload.admin_name.strip().lower()
    if not admin_name:
        raise HTTPException(status_code=400, detail="Administrador invalido.")

    global participants, winners, race_started_at
    participants = [
        serialize_participant(participant)
        for participant in participants
        if participant_name(participant).lower() == admin_name
    ]
    winners = [winner for winner in winners if winner.lower() == admin_name]
    race_started_at = None

    return build_state()
