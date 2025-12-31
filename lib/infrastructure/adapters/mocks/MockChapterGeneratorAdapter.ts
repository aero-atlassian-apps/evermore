import { ChapterGeneratorPort, ChapterGeneratorResult } from '../../../core/application/ports/ChapterGeneratorPort';

export class MockChapterGeneratorAdapter implements ChapterGeneratorPort {
  async generateChapter(
    transcript: string,
    previousContext: any[] = []
  ): Promise<ChapterGeneratorResult> {
    console.log('🧪 Using MockChapterGeneratorAdapter for demo/testing...');

    // Simulate processing delay for realism
    await new Promise(resolve => setTimeout(resolve, 2000));

    const demoChapter = `
# The First Cast of Summer

The summer of 1955 wasn't just hot; it was the kind of heat that shimmered off the asphalt and made the air taste like dust. But down by the lake, under the canopy of ancient oaks, the world was cool and smelled of damp earth and pine needles. This was where I learned patience, though I didn't know it at the time.

My father had woken me before dawn, a conspiracy of whispers and heavy boots in the hallway. "Quiet now, Joey," he'd said, his voice a low rumble. "Fish don't wait for sleepyheads." We drove in the old Ford, the windows down, listening to the static of the AM radio fading in and out as we left the city behind.

The lake was a sheet of glass reflecting the bruised purple of the morning sky. I remember the weight of the fishing rod in my hands—it felt enormous, a tool for giants, not for a scrawny ten-year-old with scraped knees. Dad showed me how to bait the hook, his large, calloused hands moving with surprising delicacy. "It's not about the catch," he told me, lighting his pipe, the sweet smoke drifting over the water. "It's about being here."

I didn't believe him then. I wanted the tug, the fight, the prize. I sat there for hours, watching the red and white bobber dance on the ripples, bored out of my mind. I counted dragonflies. I watched a heron stalk the shallows. And then, just as the sun began to burn through the morning mist, it happened. The bobber plunged.

"Steady," Dad said, not reaching for the rod but watching me. "Easy now."

The reel screamed. The rod bent. It wasn't a monster, just a pan-sized bluegill, but to me, it was Moby Dick. When I finally swung it onto the grassy bank, flapping and silver-bright, I felt a surge of pride that nearly knocked me over. Dad was smiling, that rare, full smile that crinkled the corners of his eyes.

"Well done, son," he said. And in that moment, with the smell of lake water and pipe tobacco in the air, I understood. It wasn't about the fish. It was about the morning, the silence shared, and the man sitting beside me who was teaching me how to be in the world.
    `.trim();

    return {
      chapter: demoChapter,
      atoms: {
        narrativeArc: "A young boy learns the value of patience and connection during a fishing trip with his father in 1955.",
        emotionalValence: "nostalgia",
        bestQuotes: [
          {
            text: "Fish don't wait for sleepyheads.",
            reason: "Captures the father's playful but disciplined nature."
          },
          {
            text: "It's not about the catch. It's about being here.",
            reason: "The central theme and lesson of the memory."
          }
        ],
        sensoryDetails: [
          {
            sense: "sight",
            phrase: "heat that shimmered off the asphalt",
            context: "Describing the summer heat"
          },
          {
            sense: "smell",
            phrase: "damp earth and pine needles",
            context: "The contrast of the lake environment"
          },
          {
            sense: "smell",
            phrase: "sweet smoke drifting over the water",
            context: "Father's pipe smoke"
          },
          {
            sense: "sound",
            phrase: "reel screamed",
            context: "The moment of catching the fish"
          }
        ],
        previousChapterConnections: [
          {
            previousChapter: "Early Years in Detroit",
            connectionType: "continuation",
            description: "Continues the story of his relationship with his father introduced in the previous chapter."
          }
        ]
      }
    };
  }
}
