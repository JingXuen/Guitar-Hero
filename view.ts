import { PlayMusic } from "./state";
import { Circle, State, Note, Tail } from "./types";
import { isNotNullOrUndefined } from "./util";
export { updateView, createSvgElement }

const attr = (e: Element, o: { [p: string]: unknown }) => { for (const k in o) e.setAttribute(k, String(o[k])) }

/**
 * Creates an SVG element with the given properties.
 *
 * See https://developer.mozilla.org/en-US/docs/Web/SVG/Element for valid
 * element names and properties.
 *
 * @param namespace Namespace of the SVG element
 * @param name SVGElement name
 * @param props Properties to set on the SVG element
 * @returns SVG element
 */
const createSvgElement = (
    namespace: string | null,
    name: string,
    props: Record<string, string> = {},
) => {
    const elem = document.createElementNS(namespace, name) as SVGElement;
    Object.entries(props).forEach(([k, v]) => elem.setAttribute(k, v));
    return elem;
};

/**
 * Update the SVG game view.  
 * 
 * @param onFinish a callback function to be applied when the game ends.  For example, to clean up subscriptions.
 * @param s the current game model State
 * @returns void
 */
function updateView(onFinish: () => void): (_:State)=>void {
	return function (s: State): void {
		const
			svg = document.querySelector("#svgCanvas") as SVGGraphicsElement &
				HTMLElement;
		
		    // Text fields
		const
			multiplier = document.querySelector("#multiplierText") as HTMLElement,
			scoreText = document.querySelector("#scoreText") as HTMLElement,
			gameover = document.querySelector("#gameOver") as SVGGraphicsElement & HTMLElement,
			highScoreText = document.querySelector("#highScoreText",) as HTMLElement;


        // if getElement is null, exit function early without doing anything
        if (!svg ) return 

		

        // null checking above cannot apply in updateBodyView
        // typescript cannot narrow the type down outside the scope because
        // it can't guarantee that this function gets called synchronously
		const updateCircleView = (rootSVG: HTMLElement) => (c: Circle) => {

			function createCircle() {
				//console.log("WHY\n a \n new \nCIRCLE WAS CREATED!!!!\n");
				const visibility = c.note.user_played ? "visible" : "hidden";
				const v = createSvgElement(rootSVG.namespaceURI, "circle", {
					r: `${Note.RADIUS}`,
					id: c.objectId.id,
					cx: c.x,
					cy: `${c.y}`,
					style: `fill: ${c.color}`,
					class: "shadow",
					visibility: visibility
				});
				rootSVG.appendChild(v)
				return v;
			}

			const v = document.getElementById(c.objectId.id) || createCircle();
			attr(v, { cx: `${c.x}`, cy: `${c.y}` });

		};

		const updateTailView = (svg: HTMLElement) => (t: Tail) => {
            function createTailView() {
				const visibility = t.note.user_played ? "visible" : "hidden";
                const rect = createSvgElement(svg.namespaceURI, "rect", {
                    x: t.x,
                    y: `${t.y}`, // Place the tail at the starting y position
                    width: `${t.width}`,
                    height: `${t.length}`,
					style:  `fill: ${t.color} ; stroke: none`, // remove the stroke of the rectangle
                    class: "shadow",
                    id: `${t.objectId.id}`,
                    visibility: visibility,
                });
                svg.appendChild(rect);
                return rect;
            }
			const v = document.getElementById(`${t.objectId.id}`) || createTailView();
			attr(v, { x: `${t.x}`, y: `${t.y}`, height: `${t.length}` });
        };


		// The order of the following two functions is important as the Tail should be at the back of the Circle
		
		// Append tails first
		s.tails.forEach(updateTailView(svg));

        // Append circles after tails
		s.circles.forEach(updateCircleView(svg));


		// we shall play the sound of the tail here


		s.exit.forEach((c) => {
			// after user hit the note, the user_played flag of the note will be set to false
			// so they will be played
			if (!c.note.user_played) {
				PlayMusic.playNote(c.note, s.samples);
			} else {
				// here should replace with random but i have no time to implement it
				PlayMusic.playNote(c.note, s.samples);
			}
		})

		s.exitTail.forEach((c) => {
			// after user hit the note, the user_played flag of the note will be set to false
			// so they will be played
			if (!c.note.user_played) {
				PlayMusic.playNote(c.note, s.samples);
			}
		})


        s.exit.map(c => document.getElementById(c.objectId.id))
            .filter(isNotNullOrUndefined)
            .forEach(v => {
				try {
                    svg.removeChild(v)
                } catch (e) {
                    // rarely it can happen that a bullet can be in exit
                    // for both expiring and colliding in the same tick,
                    // which will cause this exception
                    console.log("Already removed: " + v.id)
                }
			})
		
		s.exitTail.map(t => document.getElementById(t.objectId.id))
            .filter(isNotNullOrUndefined)
			.forEach(v => {
                try {
                    svg.removeChild(v)
                } catch (e) {
                    // rarely it can happen that a bullet can be in exit
                    // for both expiring and colliding in the same tick,
                    // which will cause this exception
                    console.log("Already removed: " + v.id)
                }
			})
		
		multiplier.innerHTML = String(s.multiplier);
		scoreText.innerHTML = String(s.score);
		highScoreText.innerHTML = String(s.highScore);
		
		if (s.gameEnd) {
			gameover.setAttribute("visibility", "visible");
			gameover.parentNode!.appendChild(gameover);
        }
    }
}