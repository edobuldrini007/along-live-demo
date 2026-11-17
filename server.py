"""ALONG V6 — in-memory classroom named-group demonstration."""
from __future__ import annotations
import io
import json
import secrets
import threading
import time
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen, Request as URLRequest
from typing import Literal

import qrcode
from fastapi import FastAPI, Header, HTTPException
from fastapi.responses import FileResponse, Response
from pydantic import BaseModel, Field

BASE = Path(__file__).resolve().parent
app = FastAPI(title="ALONG Classroom Demo", docs_url=None, redoc_url=None)
rooms = {}
lock = threading.RLock()
slots = {"market": ["09:30", "10:30"], "chess": ["09:45", "16:00"]}
class Join(BaseModel):
    activity: Literal["market", "chess"]
    origin: Literal["sang", "tai"]
    slot: str = Field(max_length=5)
    pace: Literal["regular", "gentle"] = "regular"
    display_name: str = Field(default="", max_length=32)
    participant_id: str | None = None
    participant_token: str | None = None
class Leave(BaseModel):
    participant_id: str
    participant_token: str
class AdminAction(BaseModel):
    admin_key: str

def get_room(code):
    room = rooms.get(code.upper())
    if not room:
        raise HTTPException(404, "Session not found. Ask the presenter for a new QR code.")
    return room

def group_key(p):
    return f"{p['activity']}|{p['slot']}|{p['pace']}"

def member_view(p):
    return {"display_name": p["display_name"], "sample": p["sample"], "origin": p["origin"]}

def group_state(room):
    people = list(room["people"].values()) + list(room["sample"].values())
    groups = []
    for activity in ("market","chess"):
        for slot in slots[activity]:
            for pace in ("regular","gentle"):
                members = [p for p in people if p["activity"] == activity and p["slot"] == slot and p["pace"] == pace]
                if not members: continue
                groups.append({"id": f"{activity}|{slot}|{pace}", "activity": activity, "slot":slot,
                    "pace":pace, "total":len(members), "live":sum(not p["sample"] for p in members),
                    "sample":sum(p["sample"] for p in members),
                    "origins":{o:sum(p["origin"] == o for p in members) for o in ("sang","tai")},
                    "shared_node":"CP-S" if activity=="market" else "CP-X",
                    "destination":"Wah Fu (II) Market" if activity=="market" else "Banyan Tree Area"})
    return {"code":room["code"], "total":len(people), "live":len(room["people"]),
        "sample":len(room["sample"]), "groups":groups, "updated_at":time.time(),
        "routes_verified":False,
        "notice":"Concept-only checkpoint network. No step-free route has been certified."}

def auth(room,key):
    if not secrets.compare_digest(room["admin"],key):
        raise HTTPException(403,"Presenter key required")

@app.get("/")
def index():
    return FileResponse(BASE/"static"/"index.html")
@app.get("/presenter")
def presenter():
    return FileResponse(BASE/"static"/"presenter.html")
@app.get("/static/{filename}")
def static(filename: str):
    if filename not in {"style.css","map.css","app.js","presenter.js","network-map.js","weather.js"}:
        raise HTTPException(404)
    return FileResponse(BASE/"static"/filename, media_type="text/css" if filename.endswith(".css") else "text/javascript")
@app.get("/api/health")
def health():
    return {"ok":True,"mode":"in_memory_classroom_demo","active_rooms":len(rooms)}

@app.post("/api/rooms")
def create_room():
    with lock:
        if len(rooms)>=40: raise HTTPException(429, "Room limit reached")
        chars="ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
        code="".join(secrets.choice(chars) for _ in range(6))
        while code in rooms: code="".join(secrets.choice(chars) for _ in range(6))
        admin=secrets.token_urlsafe(24)
        rooms[code]={"code":code,"admin":admin,"people":{},"sample":{}}
        return {"code":code,"admin_key":admin}

@app.get("/api/rooms/{code}/state")
def state(code:str):
    with lock: return group_state(get_room(code))

@app.post("/api/rooms/{code}/join")
def join(code:str, body: Join):
    if body.slot not in slots[body.activity]: raise HTTPException(422,"Invalid time for activity")
    name=" ".join(body.display_name.strip().split())
    name="".join(ch for ch in name if ch.isprintable() and ch not in "<>\\/{}[]")
    if "http" in name.lower() or "@" in name or len(name)>24:
        raise HTTPException(422,"Use a first name or nickname, no contact details")
    with lock:
        room=get_room(code)
        old=room["people"].get(body.participant_id) if body.participant_id else None
        if old:
            if not secrets.compare_digest(old["token"],body.participant_token or ""):
                raise HTTPException(403,"Participant belongs to another device")
            pid=body.participant_id
            token=old["token"]
        else:
            if len(room["people"])>=150: raise HTTPException(429,"Demo group full")
            pid=secrets.token_urlsafe(13)
            token=secrets.token_urlsafe(24)
        if not name: name=f"Guest {len(room['people'])+1}"
        room["people"][pid]={"display_name":name,"activity":body.activity,"origin":body.origin,
            "slot":body.slot,"pace":body.pace,"token":token,"sample":False}
        return {"participant_id":pid,"participant_token":token,"display_name":name,
            "group_id":f"{body.activity}|{body.slot}|{body.pace}","state":group_state(room)}

@app.post("/api/rooms/{code}/companions")
def companions(code:str,body:Leave):
    with lock:
        room=get_room(code)
        own=room["people"].get(body.participant_id)
        if not own or not secrets.compare_digest(own["token"],body.participant_token):
            raise HTTPException(403,"Participant authorization required")
        key=group_key(own)
        return {"group_id":key,
            "members":[member_view(p) for p in room["people"].values() if group_key(p)==key],
            "samples":[member_view(p) for p in room["sample"].values() if group_key(p)==key],
            "current_user":own["display_name"],
            "note":"Classroom demo; names are visible to matched participants only."}

@app.get("/api/rooms/{code}/admin-members")
def admin_members(code:str,admin_key:str=Header(...,alias="X-Admin-Key")):
    with lock:
        room=get_room(code)
        auth(room,admin_key)
        return {"groups":[{"id":g["id"],
            "members":[member_view(p) for p in room["people"].values() if group_key(p)==g["id"]],
            "samples":[member_view(p) for p in room["sample"].values() if group_key(p)==g["id"]]}
            for g in group_state(room)["groups"]]}

@app.post("/api/rooms/{code}/leave")
def leave(code:str,body:Leave):
    with lock:
        room=get_room(code)
        old=room["people"].get(body.participant_id)
        if old:
            if not secrets.compare_digest(old["token"],body.participant_token):
                raise HTTPException(403,"Participant belongs to another device")
            del room["people"][body.participant_id]
    return {"ok":True}

@app.post("/api/rooms/{code}/seed")
def seed(code:str,body:AdminAction):
    with lock:
        room=get_room(code)
        auth(room,body.admin_key)
        examples=[("market","09:30","regular","sang"),("market","09:30","regular","tai"),
          ("market","10:30","gentle","tai"),("chess","09:45","regular","sang"),
          ("chess","09:45","regular","tai"),("chess","16:00","gentle","sang")]
        room["sample"]={f"sample-{i}":dict(zip(("activity","slot","pace","origin"),vals),
           sample=True,display_name=f"Sample {i}") for i,vals in enumerate(examples,1)}
        return group_state(room)

@app.post("/api/rooms/{code}/clear-samples")
def clear_samples(code:str,body:AdminAction):
    with lock:
        room=get_room(code)
        auth(room,body.admin_key)
        room["sample"].clear()
        return group_state(room)

@app.post("/api/rooms/{code}/reset")
def reset(code:str,body:AdminAction):
    with lock:
        room=get_room(code)
        auth(room,body.admin_key)
        room["sample"].clear()
        room["people"].clear()
        return group_state(room)

@app.get("/api/qr")
def qr(url:str):
    u=urlparse(url)
    if u.scheme not in ("https","http") or not u.netloc or len(url)>500:
        raise HTTPException(422,"Invalid QR URL")
    q=qrcode.QRCode(box_size=8,border=3,error_correction=qrcode.constants.ERROR_CORRECT_M)
    q.add_data(url)
    q.make(fit=True)
    image=q.make_image(fill_color="black",back_color="white")
    buf=io.BytesIO()
    image.save(buf,"PNG")
    return Response(content=buf.getvalue(),media_type="image/png",headers={"Cache-Control":"no-store"})

# HKO current observations; no made-up readings.
HKO_URL="https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=en"
weather_lock=threading.RLock()
weather_cache={"record":None,"at":0,"success":False}
HKO_ICONS={50:"Sunny",51:"Sunny periods",52:"Sunny intervals",53:"Showers",54:"Showers",
  60:"Cloudy",61:"Overcast",62:"Light rain",63:"Rain",64:"Heavy rain",
  65:"Thunderstorms",76:"Mainly cloudy",77:"Mainly fine"}
def extract_weather(raw):
    temp=raw.get("temperature") or {}
    rows=temp.get("data") or []
    valid=[]
    for row in rows:
        try:
            value=float(row.get("value"))
            place=str(row.get("place",""))[:80]
            if -20<value<60 and place:valid.append((place,value))
        except (ValueError,TypeError,AttributeError): pass
    if not valid:return None
    pref=("Aberdeen","Wong Chuk Hang","Hong Kong Observatory","King's Park")
    station,value=next((r for p in pref for r in valid if r[0].lower()==p.lower()), valid[0])
    iso=temp.get("recordTime") or raw.get("updateTime")
    try:
        dt=datetime.fromisoformat(str(iso).replace("Z","+00:00"))
        if not dt.tzinfo: return None
    except (TypeError,ValueError):return None
    hum=None; hum_station=None
    for row in (raw.get("humidity") or {}).get("data",[]):
        try:
            h=round(float(row.get("value")))
            if 0<=h<=100:
                hum=h;hum_station=str(row.get("place","Hong Kong Observatory"))[:80];break
        except (ValueError,TypeError,AttributeError):pass
    icon=(raw.get("icon") or [None])[0]
    try:icon=int(icon)
    except (ValueError,TypeError): icon=None
    warns=raw.get("warningMessage") or []
    if isinstance(warns,str):warns=[warns]
    if not isinstance(warns,list):warns=[]
    return {"temperature_c":round(value,1),"station":station,"observed_at":dt.isoformat(),
      "report_updated_at":raw.get("updateTime"),"humidity_pct":hum,"humidity_station":hum_station,
      "condition":HKO_ICONS.get(icon,"Current conditions"),"icon_code":icon,
      "warnings":[str(x)[:280] for x in warns if isinstance(x,str)][:2],
      "source":"Hong Kong Observatory","source_url":HKO_URL}
@app.get("/api/weather")
def weather():
    now=time.time()
    with weather_lock:
        if now-weather_cache["at"]>300:
            weather_cache["at"]=now
            try:
                req=URLRequest(HKO_URL,headers={"Accept":"application/json","User-Agent":"ALONG-Academic-Demo"})
                with urlopen(req,timeout=5) as r:
                    raw=json.loads(r.read(150000))
                weather_cache["record"]=extract_weather(raw)
                weather_cache["success"]=weather_cache["record"] is not None
            except Exception:
                weather_cache["success"]=False
        record=weather_cache["record"]
        if record:
            try: age=max(0,(datetime.now(timezone.utc)-datetime.fromisoformat(record["observed_at"])).total_seconds())
            except (TypeError,ValueError):age=999999
            if age<=10800:
                response=dict(record)
                response.update(status="live" if age<=5400 and weather_cache["success"] else "cached",
                    age_minutes=int(age//60),is_current_at_activity_time=False)
                return response
        return {"status":"unavailable","source":"Hong Kong Observatory","source_url":HKO_URL,
          "temperature_c":None,"station":None,"humidity_pct":None,"condition":None,"warnings":[],
          "observed_at":None,"is_current_at_activity_time":False}
