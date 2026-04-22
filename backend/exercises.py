import os
from uuid import uuid4

import aiosqlite
from fastapi import APIRouter

from models import LibraryExercise, CreateExerciseRequest

DB_PATH = os.getenv("DB_PATH", "/data/programs.db")

router = APIRouter()

SEED_EXERCISES = [
    ("Quad Sets", 3, 10, None, 2, "Lie flat on your back. Tighten your quadriceps by pressing the back of your knee into the floor. Hold for 5 seconds, then relax."),
    ("Straight Leg Raises", 3, 10, None, 2, "Lie on your back with one knee bent. Tighten the thigh of the straight leg and lift it to the height of the bent knee. Lower slowly."),
    ("Terminal Knee Extension", 3, 15, None, 3, "Anchor a resistance band behind the knee. Stand with a slight knee bend. Straighten the knee fully against the band, squeezing the quad at the end."),
    ("Short Arc Quads", 3, 10, None, 2, "Lie on your back with a rolled towel under the knee. Straighten the knee fully and hold 2 seconds, then lower slowly."),
    ("Clamshells", 3, 15, None, 3, "Lie on your side with hips and knees bent to 45°. Keep feet together and rotate the top knee upward. Lower with control."),
    ("Glute Bridges", 3, 12, None, 3, "Lie on your back with knees bent and feet flat. Drive hips up by squeezing glutes until your body forms a straight line from knees to shoulders. Hold 2 seconds, lower slowly."),
    ("Single-Leg Glute Bridge", 3, 10, None, 2, "Lie on your back with one knee bent. Drive hips up through the bent leg while keeping pelvis level. Hold 2 seconds, lower with control."),
    ("Side-Lying Hip Abduction", 3, 15, None, 3, "Lie on your side with legs straight. Keep toes forward and lift the top leg to about 45°. Lower slowly. Avoid rotating the hip."),
    ("Step-Ups", 3, 10, None, 3, "Stand in front of a step. Place one foot on the step and drive through that heel to step up fully. Lower the trailing foot back down with control. Keep knee aligned over second toe."),
    ("Heel Raises", 3, 15, None, 3, "Stand with feet hip-width apart. Rise on your toes as high as possible, hold 1 second, then lower slowly over 3 seconds."),
    ("Ankle Pumps", None, 20, None, 3, "Sit or lie with leg elevated. Pump the ankle up and down through full range of motion slowly and rhythmically."),
    ("Shoulder Pendulum", 3, None, 60, 2, "Lean forward with your uninvolved hand on a table. Let the affected arm hang and use body momentum to swing it gently in circles and back-and-forth. Do not use shoulder muscles."),
    ("Scapular Retraction", 3, 15, None, 3, "Sit or stand tall. Squeeze shoulder blades together without shrugging. Hold 5 seconds, then release. Keep chin tucked and neck relaxed."),
    ("Shoulder External Rotation", 3, 15, None, 3, "Hold a resistance band with elbow bent to 90° at your side. Rotate your forearm outward away from your body while keeping your elbow tucked. Return slowly."),
    ("Shoulder Internal Rotation", 3, 15, None, 3, "Hold a resistance band with elbow bent to 90° at your side. Rotate your forearm inward across your body while keeping your elbow tucked. Return slowly."),
    ("Chin Tucks", 3, 10, None, 3, "Sit or stand tall. Gently retract your chin straight back without tilting the head. Hold 5 seconds and release. Think of making your neck tall."),
    ("Cat-Cow Stretch", 3, 10, None, 3, "On hands and knees, inhale as you arch the back and lift head and tailbone, then exhale as you round the spine and tuck chin and pelvis. Flow smoothly."),
    ("Bird Dog", 3, 10, None, 3, "On hands and knees, simultaneously extend the opposite arm and leg until parallel to the floor. Hold 3 seconds, return with control. Keep hips level."),
    ("Dead Bug", 3, 8, None, 3, "Lie on your back with arms toward the ceiling and hips and knees at 90°. Lower opposite arm and leg toward the floor while pressing your lower back down. Alternate sides."),
    ("Supine Knee-to-Chest Stretch", 3, None, 30, 3, "Lie on your back. Pull one knee toward your chest with both hands until you feel a gentle stretch in the lower back and hip. Hold, then switch."),
    ("Hip Flexor Stretch", 3, None, 30, 3, "Kneel on one knee. Shift your weight forward until you feel a stretch at the front of the hip. Keep your torso upright and tuck the pelvis slightly."),
    ("Hamstring Stretch", 3, None, 30, 3, "Lie on your back. Loop a strap around one foot and straighten the knee toward the ceiling until you feel a stretch in the back of the thigh."),
    ("Standing Calf Stretch", 3, None, 30, 3, "Stand facing a wall with the foot to be stretched behind you, heel flat. Lean into the wall until you feel a stretch in the calf."),
    ("Prone Hip Extension", 3, 12, None, 3, "Lie face down with legs straight. Tighten glutes and lift one leg a few inches off the floor, keeping the knee straight. Hold 2 seconds, lower slowly."),
    ("Wall Slides", 3, 10, None, 3, "Stand with your back and arms against a wall, elbows bent to 90°. Slide arms up the wall while maintaining contact with elbows and wrists. Slide back down with control."),
]


async def init_exercises_table():
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute("""
            CREATE TABLE IF NOT EXISTS exercises (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                default_sets INTEGER,
                default_reps INTEGER,
                default_duration_seconds INTEGER,
                default_frequency_per_week INTEGER NOT NULL,
                instructions TEXT NOT NULL,
                is_custom INTEGER NOT NULL DEFAULT 0
            )
        """)
        cursor = await db.execute("SELECT COUNT(*) FROM exercises WHERE is_custom = 0")
        count = (await cursor.fetchone())[0]
        if count == 0:
            for name, sets, reps, duration, freq, instructions in SEED_EXERCISES:
                await db.execute(
                    "INSERT INTO exercises (id, name, default_sets, default_reps, default_duration_seconds, "
                    "default_frequency_per_week, instructions, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?, 0)",
                    (str(uuid4()), name, sets, reps, duration, freq, instructions),
                )
        await db.commit()


@router.get("/exercises")
async def list_exercises(search: str = ""):
    async with aiosqlite.connect(DB_PATH) as db:
        db.row_factory = aiosqlite.Row
        if search:
            cursor = await db.execute(
                "SELECT * FROM exercises WHERE name LIKE ? ORDER BY is_custom ASC, name ASC",
                (f"%{search}%",),
            )
        else:
            cursor = await db.execute(
                "SELECT * FROM exercises ORDER BY is_custom ASC, name ASC"
            )
        rows = await cursor.fetchall()
        return [{**dict(row), "is_custom": bool(row["is_custom"])} for row in rows]


@router.post("/exercises")
async def create_exercise(req: CreateExerciseRequest):
    exercise = LibraryExercise(
        name=req.name,
        default_sets=req.default_sets,
        default_reps=req.default_reps,
        default_duration_seconds=req.default_duration_seconds,
        default_frequency_per_week=req.default_frequency_per_week,
        instructions=req.instructions,
        is_custom=True,
    )
    async with aiosqlite.connect(DB_PATH) as db:
        await db.execute(
            "INSERT INTO exercises (id, name, default_sets, default_reps, default_duration_seconds, "
            "default_frequency_per_week, instructions, is_custom) VALUES (?, ?, ?, ?, ?, ?, ?, 1)",
            (exercise.id, exercise.name, exercise.default_sets, exercise.default_reps,
             exercise.default_duration_seconds, exercise.default_frequency_per_week, exercise.instructions),
        )
        await db.commit()
    return exercise
