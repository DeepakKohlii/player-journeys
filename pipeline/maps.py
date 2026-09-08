from dataclasses import dataclass


@dataclass(frozen=True)
class MapConfig:
    map_id: str
    label: str
    scale: float
    origin_x: float
    origin_z: float
    source_image: str


MAPS = {
    "AmbroseValley": MapConfig("AmbroseValley", "Ambrose Valley", 900.0, -370.0, -473.0, "AmbroseValley_Minimap.png"),
    "GrandRift":     MapConfig("GrandRift",     "Grand Rift",     581.0, -290.0, -290.0, "GrandRift_Minimap.png"),
    "Lockdown":      MapConfig("Lockdown",      "Lockdown",      1000.0, -500.0, -500.0, "Lockdown_Minimap.jpg"),
}


def world_to_uv(x, z, cfg: MapConfig):
    u = (x - cfg.origin_x) / cfg.scale
    v = 1.0 - (z - cfg.origin_z) / cfg.scale
    return u, v

