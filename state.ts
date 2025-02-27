import { not, except, } from './util';
import {Constants, Note, Circle, State, NoteType, Action, ObjectId, Key, Tail } from './types';
import * as Tone from "tone";

export { Tick, PlayMusic, Circles, Restart, Tails, reduceState };


class PlayMusic implements Action {

	constructor(public readonly key: Key) { } 

	// Each time a key is pressed
	// The correct note must be played if the circles align with the bottom row
	// Otherwise, a random note is played.

	apply(s: State): State {
		const isCircleAligned = (circle: Circle): boolean => 
			Math.abs(circle.y - Constants.TARGET_POSITION) <= Constants.TOLERANCE &&
			(circle.note.key === this.key) &&
			(circle.note.user_played);
	
		// Identify the bottom circles that are aligned and need to be updated
		const bottomCircles = s.circles
			.filter(isCircleAligned)
			// convert the user_played flag to false since only we set only user_played false can be correct output
			.map(c => ({ ...c, note: { ...c.note, user_played: false } }));
	
		// Update only the circles that are part of bottomCircles
		const updatedCircles = s.circles.map(c => 
			bottomCircles.find(bc => bc.objectId.id === c.objectId.id) ? 
			{ ...c, note: { ...c.note, user_played: false } } : 
			c
		);

		return {
			...s,
			circles: updatedCircles,
			mulCount: bottomCircles.length > 0 ? s.mulCount + bottomCircles.length : 0,
			exit: s.exit.concat(bottomCircles),
			score: s.score + bottomCircles.length,
			highScore: (s.score + bottomCircles.length) > s.highScore ? s.score + bottomCircles.length : s.highScore
		};
	}


	// Play the note of the circle actually this can be done in the view.ts
	static playNote(note: NoteType, samples: { [key: string]: Tone.Sampler }) {
		const duration = note.end - note.start;
		samples[note.instrument_name].triggerAttackRelease(
			Tone.Frequency(note.pitch, "midi").toNote(), // Convert MIDI note to frequency
			duration, // Duration of the note in seconds
			undefined, // Use default time for note onset
			note.velocity / 127, // Set velocity to quarter of the maximum velocity
		);
	}
}

class Circles implements Action{

	constructor(public readonly note: NoteType) { }
	
	apply(s: State): State {
		// create a new circle based on its corresponding note
		const newCircle =
			Circles.createCircle({ id: String(s.objCount), createTime: s.time })
				(`${(this.note.column + 1) * 20}%`, 0, this.note.color, this.note);
		return {
			...s,
			circles: [...s.circles, newCircle],
			objCount: s.objCount + 1
		}

	}
	static createCircle = (oid: ObjectId) => (x: string, y: number, color: string, note: NoteType): Circle => {
		return {
			x: x,
			y: y,
			color: color,
			note: note,
			objectId: oid,
			radius: Note.RADIUS,
		} as Circle;
	}
}

class Tails implements Action{

	constructor(public readonly note: NoteType) { }
	
	apply(s: State): State {

		const newTail =
			Tails.createTail(
				{ id: String(s.objCount), createTime: s.time }
			)(
				`${((this.note.column + 1) * 20) - Constants.WIDTH / 4}%`,
				-(this.note.end - this.note.start) * Constants.STEP_SIZE * Constants.INTERVAL_DURATION,
				this.note.color,
				this.note,
				(this.note.end - this.note.start) * Constants.STEP_SIZE * Constants.INTERVAL_DURATION, //* Constants.TICK_RATE_MS
				Constants.WIDTH
			);
		return {
			...s,
			tails: [...s.tails, newTail], 
			objCount: s.objCount + 1
		}

	}

	static createTail = (oid: ObjectId) => (x: string, y: number, color: string, note: NoteType, length: number, width: number): Tail => {
		return {
			x: x,
			y: y,
			color: color,
			note: note,
			objectId: oid,
			length: length,
			width: width,
			radius: Note.RADIUS,
			played: false
		} as Tail; 
	}

}


class Tick implements Action {
    constructor(public readonly elapsed: number) { }
    /** 
     * interval tick: bodies move, collisions happen, bullets expire
     * @param s old State
     * @returns new State
     */
	apply(s: State): State {
		const
			expired = (c: Circle) => c.y >= Constants.TARGET_POSITION,
			expiredCircles: Circle[] = s.circles.filter(expired),
			activeCircles = s.circles.filter(not(expired)),
			expiredTail = (t: Tail) => t.y >= Constants.TARGET_POSITION,
			expiredTails = s.tails.filter(expiredTail),
			activeTails = s.tails.filter(not(expiredTail)),
			after10: boolean = s.mulCount >= 10,
			missedCircles = expiredCircles.filter(c => c.note.user_played);
		if (expiredTails.length > 0 || activeTails.length > 0) {
			console.log("Tail expired in Tick action apply", expiredTails);
		}

        return Tick.handleCollisions({
			...s,
			mulCount: after10 ? 0 : s.mulCount,
			multiplier: missedCircles.length < 1 ? after10 ? parseFloat((s.multiplier + 0.2).toFixed(1)) : s.multiplier : 1,
			circles: activeCircles.map(Tick.moveCircle),
			tails: activeTails.map(Tick.moveTail),
			exit: expiredCircles,
			exitTail: expiredTails,
			time: this.elapsed,
        })
	}
	
    /** 
     * all tick-based physical movement comes through this function
     * @param c a Circle to move
     * @returns the moved Circle
     */
    static moveCircle = (c: Circle): Circle => ({
		...c,
		y: c.y + Constants.STEP_SIZE,
	})

    /** 
     * all tick-based physical movement comes through this function
     * @param t a Tail to move
     * @returns the moved Tail
     */
	static moveTail = (t: Tail): Tail => {
		
		if (t.y >= Constants.TARGET_POSITION - t.length) {
			const newLen = Math.max(t.length - Constants.STEP_SIZE, 0);
			return {
				...t,
				played: true,
				length: newLen <= 1 ? 0 : newLen,
				// no matter what, the y position of the tail will be updated
				y: t.y + Constants.STEP_SIZE 
			};
		}

		return {
			...t,
			y: t.y + Constants.STEP_SIZE,
		};

	}

    /** 
     * check a State for collisions:
     * bullets destroy rocks spawning smaller ones
     * ship colliding with rock ends game
     * @param s Game State
     * @returns a new State
     */
    static handleCollisions = (s: State): State => {
		const
			// check if the circle has collided with the target position
			ciclesCollided = (c: Circle) => c.y > Constants.TARGET_POSITION,
			collidedCircles = s.circles.filter(ciclesCollided),
			cut = except((a: Circle) => (b: Circle) => a.objectId.id === b.objectId.id),
			// check if the tail has collided with the target position
			tailsCollided = (t: Tail) => t.y >= Constants.TARGET_POSITION + t.length,
			collidedTails = s.tails.filter(tailsCollided),
			//missedCircles = collidedCircles.filter(c => c.note.user_played),
			cutTails = except((a: Tail) => (b: Tail) => a.objectId.id === b.objectId.id);
		if (collidedTails.length > 0) {
			console.log("Tail collided in handleCollisions", collidedTails);
		}
        return {
			...s,
			circles: cut(s.circles)(collidedCircles),
			tails: cutTails(s.tails)(collidedTails),
			exitTail: s.exitTail.concat(collidedTails),
			exit: s.exit.concat(collidedCircles),
			notesPlayed: s.notesPlayed + collidedCircles.length,
			gameEnd: s.notesPlayed + collidedCircles.length >= s.notes.length,			
			//objCount: s.objCount + collidedCircles.length,
			//gameEnd: collidedCircles.length > 0
        }
    }
}


class Restart implements Action {

	apply(s: State): State {
		return {
			...s,
			circles: [],
			exit: [],
			time: 0,
			objCount: 0,
			gameEnd: false,
			multiplier: 1,
			mulCount: 0,
			score: 0,
			notesPlayed: 0
		}
	}
}

const
    /**
     * state transducer
     * @param s input State
     * @param action type of action to apply to the State
     * @returns a new State 
     */
    reduceState = (s: State, action: Action) => action.apply(s);