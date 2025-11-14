import random
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Sorteio API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class ParticipantPayload(BaseModel):
    name: str


participants: List[str] = []
winners: List[str] = []


class DrawPayload(BaseModel):
    count: int = 1


@app.get("/participants")
def list_participants():
    return {"participants": participants, "winners": winners}


@app.post("/participants", status_code=201)
def add_participant(payload: ParticipantPayload):
    name = payload.name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nome e obrigatorio.")

    normalized = name.lower()
    for registered in participants:
        if registered.lower() == normalized:
            return {"participants": participants, "winner": current_winner}

    participants.append(name)
    return {"participants": participants, "winners": winners}


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

    global winners
    winners = random.sample(participants, count)
    return {"winners": winners}


@app.post("/winner/reset")
def reset_winner():
    global winners
    winners = []
    return {"winners": winners}


@app.get("/health")
def health_check():
    return {"status": "ok", "totalParticipants": len(participants), "winners": winners}
