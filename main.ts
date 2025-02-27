/**
 * Inside this file you will use the classes and functions from rx.js
 * to add visuals to the svg element in index.html, animate them, and make them interactive.
 *
 * Study and complete the tasks in observable exercises first to get ideas.
 *
 * Course Notes showing Asteroids in FRP: https://tgdwyer.github.io/asteroids/
 *
 * You will be marked on your functional programming style
 * as well as the functionality that you implement.
 *
 * Document your code!
 */

import "./style.css";
import { Key, Action,State,  NoteType, Constants, Viewport, } from "./types";
import { Tick, Circles, PlayMusic, reduceState, Restart, Tails } from "./state";
import { updateView } from "./view";


import { fromEvent, interval, merge, timer, from, Observable, of, Subscription } from "rxjs";
import { map, filter, scan, mergeMap, switchMap, zipWith, takeUntil } from "rxjs/operators";
import * as Tone from "tone";
import { SampleLibrary } from "./tonejs-instruments";


/** Rendering (side effects) */

/**
 * Displays a SVG element on the canvas. Brings to foreground.
 * @param elem SVG element to display
 */
const show = (elem: SVGGraphicsElement) => {
    elem.setAttribute("visibility", "visible");
    elem.parentNode!.appendChild(elem);
};

/**
 * Hides a SVG element on the canvas.
 * @param elem SVG element to hide
 */
const hide = (elem: SVGGraphicsElement) =>
    elem.setAttribute("visibility", "hidden");



/**
 * This is the function called on page load. Your main game loop
 * should be called here.
 */
export function main(
    csvContents: string,
    samples: { [key: string]: Tone.Sampler },
) {
    // Canvas elements
    const svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
        HTMLElement;
    const preview = document.querySelector(
        "#svgPreview",
    ) as SVGGraphicsElement & HTMLElement;
    const container = document.querySelector("#main") as HTMLElement;
	const restartButton = document.getElementById("restartButton") as HTMLElement;

    /**
     * Remove all circles from the canvas
     */
	const clearCanvas = () => {
		const circles = document.querySelectorAll("circle");
		circles.forEach((circle) => circle.remove());
	}

    svg.setAttribute("height", `${Viewport.CANVAS_HEIGHT}`);
    svg.setAttribute("width", `${Viewport.CANVAS_WIDTH}`);

	//showKeys();

	// Initial state
	const initialState: State = {
		notesPlayed: 0,
		circles: [],
		tails: [],
		exit: [],
		exitTail: [],
		notes: startNotes(csvContents),
		time: 0,
		objCount: 0,
		highScore: 0,
		multiplier: 1,
		mulCount: 0,
		score: 0,
		gameEnd: false,
		samples: samples
	} as const;


	//map does not mutate the original array. It creates a new array
	//const circles = notes.map((note) => new Circles(note));

    /** User input */
	const
		key$ = fromEvent<KeyboardEvent>(document, "keypress"),

		fromKey = (keyCode: Key) =>
			key$.pipe(filter(({ code }) => code === keyCode));
		
	/** Determines the rate of time steps */
	const
		tick$ = interval(Constants.TICK_RATE_MS).pipe(
			map(elapsed => new Tick(elapsed))),
		
		greenPlay$ = fromKey("KeyH").pipe(map(_ => new PlayMusic("KeyH"))),

		redPlay$ = fromKey("KeyJ").pipe(map(_ => new PlayMusic("KeyJ"))),

		bluePlay$ = fromKey("KeyK").pipe(map(_ => new PlayMusic("KeyK"))),

		yellowPlay$ = fromKey("KeyL").pipe(map(_ => new PlayMusic("KeyL"))),
		
		// generate a timer for each note for the circles and tails
		noteTimers$: Observable<Action> = from(initialState.notes).pipe(
			mergeMap(note => {
				// No matter what, we always want to create a circle 
				const circle = timer(note.start * 1000).pipe(
					map(_ => new Circles(note)),
					takeUntil(fromEvent(restartButton, 'click')) // clear off the timer of circles when the restart button is clicked
				)
				// But if the note is longer than 1 second, we also want to create a tail
				if ((note.end - note.start) > 1) {
					const tail = timer(note.start * 1000).pipe(
						//delay(1), // slight delay to ensure the circle is rendered before the tail
						map(_ => new Tails(note)),
						takeUntil(fromEvent(restartButton, 'click')) // clear off the timer of tails when the restart button is clicked
					)
					return merge(circle, tail);
				} else {
					return circle;
				}

			})
		),

		restart$: (_: Observable<Action>) => Observable<Action> = action$ => 
			fromEvent(restartButton, 'click').pipe(
				// switchMap will cancel the previous restart observable if a new one is emitted
				switchMap(() => 
					merge(
						of(new Restart()),  // Emit the Reset action immediately on reset button click
						// this interval will emit the action$ imput observable every tick
						interval(Constants.TICK_RATE_MS).pipe(zipWith(action$))
					)
				),
				// map the emitted value to the second value of the
				// emitted array, which is the action
				map(value => Array.isArray(value) ? value[1] : value), // Handle both Reset and [arg, Action]
			);

	// merge all the observables into one "MAIN OBSERVABLE"
		const action$ : Observable<Action>  = merge(
			greenPlay$, redPlay$, bluePlay$, yellowPlay$, noteTimers$,
			tick$, restart$(noteTimers$)
		) as Observable<Action>;
	// scan function is used to apply the actions to the state
	// and update the state accordingly
		const state$: Observable<State> = action$.pipe(scan(reduceState, initialState));

	// subscribe to the updated satate and update the view
	// handle all the side effects here
		const subscription: Subscription =
			state$.subscribe(updateView(() => subscription.unsubscribe()));
}

/**
 * Parse the CSV contents into an array of notes
 * @param csv the contents of the CSV file
 * @returns an array of notes
 */
const startNotes = (csv: string): ReadonlyArray<NoteType> => {
	const lines = csv.trim().split("\n").slice(1);
	// Create an array of undefined with the same length as the number of lines
	const notesArray: (NoteType)[] = new Array(lines.length);

	// Iterate over the lines and update each element in the array
    lines.forEach((line, index) => {
		const [user_played, instrument_name, velocity, pitch, start, end] = line.split(","),
			// determine the color of the note
			[color, key, coloum] = assignColoum(Number(pitch)); // Destructure the return value of assignColoum
        notesArray[index] = {
            user_played: user_played === "True",
            instrument_name: instrument_name,
            velocity: Number(velocity),
            pitch: Number(pitch),
            start: Number(start),
			end: Number(end),
			key: key,
			color: color,
			column: coloum
        } as NoteType;
    });

    return notesArray;
}



const assignColoum = (pitch: number): readonly [string, string, number] => {
    const lookupTable: readonly [string, string, number][] = [
        ["green", "KeyH", 0],
        ["red", "KeyJ", 1],
        ["blue", "KeyK", 2],
        ["yellow", "KeyL", 3]
    ];

    const index = pitch % 4;
    if (index < 0 || index >= lookupTable.length) {
        throw new Error("Invalid pitch");
    }

    return lookupTable[index];
};


// The following simply runs your main function on window load.  Make sure to leave it in place.
// You should not need to change this, beware if you are.
if (typeof window !== "undefined") {
    // Load in the instruments and then start your game!
    const samples = SampleLibrary.load({
        instruments: [
            "bass-electric",
            "violin",
            "piano",
            "trumpet",
            "saxophone",
            "trombone",
            "flute",
        ], // SampleLibrary.list,
        baseUrl: "samples/",
    });

    const startGame = (contents: string) => {
        document.body.addEventListener(
            "mousedown",
            function () {
                main(contents, samples);
            },
            { once: true },
        );
    };

    const { protocol, hostname, port } = new URL(import.meta.url);
    const baseUrl = `${protocol}//${hostname}${port ? `:${port}` : ""}`;

    Tone.ToneAudioBuffer.loaded().then(() => {
        for (const instrument in samples) {
            samples[instrument].toDestination();
            samples[instrument].release = 0.5;
        }

        fetch(`${baseUrl}/assets/${Constants.SONG_NAME}.csv`)
            .then((response) => response.text())
            .then((text) => startGame(text))
            .catch((error) =>
                console.error("Error fetching the CSV file:", error),
            );
    });
}
