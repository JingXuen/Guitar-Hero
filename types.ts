export type { Key, Event, State, Circle, NoteType, Action, ObjectId, Tail };
export { Constants, Viewport, Note };
import * as Tone from 'tone';

	
/** Constants */

const Viewport = {
    CANVAS_WIDTH: 200,
    CANVAS_HEIGHT: 400,
} as const;
	
const Constants = {
	StartTime: 0,
	TICK_RATE_MS: 10,
	SONG_NAME: "RockinRobin",
	TARGET_POSITION: 350,
	STEP_SIZE: 2,
	INTERVAL_DURATION: 10,
	TOLERANCE: 20,
	WIDTH: 15,
} as const;

const Note = {
    RADIUS: 0.07 * Viewport.CANVAS_WIDTH,
    TAIL_WIDTH: 0,
};


/** Actions modify state */

interface Action {
	apply(s: State): State;
  }


/** Type declaration */

type Key = "KeyH" | "KeyJ" | "KeyK" | "KeyL";

type Event = "keydown" | "keyup" | "keypress";

type ObjectId = Readonly<{ id: string, createTime: number }>


type State = Readonly<{
    notesPlayed: number;
	time: number;
	multiplier: number;
	mulCount: number;
	circles: ReadonlyArray<Circle>,
	tails: ReadonlyArray<Tail>,
	notes: ReadonlyArray<NoteType>,
	exit: ReadonlyArray<Circle>, // collision detection
	exitTail: ReadonlyArray<Tail>,
	objCount: number,
	gameEnd: boolean,
	score: number
	highScore: number,
	samples: { [key: string]: Tone.Sampler }
}>;

type Tail = Readonly<{
	objectId: ObjectId;
	x: string;
	y: number;
	length: number;
	width: number;
	color: string;
	note: NoteType;
	played: boolean;
}>;

type Circle = Readonly<{
	objectId: ObjectId;
	x: string;
	y: number;
	color: string;
	radius: number;
	note: NoteType;
}>;

type NoteType = Readonly<{
	key: string;
	user_played: boolean;
	instrument_name: string;
	velocity: number;
	pitch: number;
	start: number;
	end: number;
	color: string;
	column: number;
}>;
