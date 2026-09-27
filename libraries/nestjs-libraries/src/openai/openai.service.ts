import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

const PicturePrompt = z.object({
  prompt: z.string(),
});

const VoicePrompt = z.object({
  voice: z.string(),
});

const ClipsPrompt = z.object({
  clips: z.array(
    z.object({
      from: z.number().describe('Number of the first line of the clip'),
      to: z.number().describe('Number of the last line of the clip'),
      title: z.string().describe('Short title of the clip'),
      content: z
        .string()
        .describe('Social media post to publish the clip with, no hashtags'),
    })
  ),
});

@Injectable()
export class OpenaiService {
  // The model answers with line numbers and not times, so a clip can only
  // start and end where the transcript really has a boundary
  async pickClips(
    title: string,
    language: string,
    segments: { start: number; end: number; text: string }[],
    maxClips: number
  ) {
    const { clips } = (
      await openai.chat.completions.parse(
        {
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes the transcript of a video and picks the parts that will work best as short vertical clips for social media.
Every line of the transcript is "number [start seconds - end seconds] text".
Pick up to ${maxClips} clips, best first. A clip is a range of consecutive lines that starts with a hook, makes one complete point and is understandable without the rest of the video.
The length of a clip is the end of its last line minus the start of its first line: it must be between 20 and 90 seconds, never longer, so check the numbers before answering.
Clips must not overlap. Write the title and the post in this language, whatever the language of these instructions: ${language}.`,
            },
            {
              role: 'user',
              content: `title: ${title}\n\n${segments
                .map(
                  (p, index) =>
                    `${index} [${p.start.toFixed(1)} - ${p.end.toFixed(1)}] ${
                      p.text
                    }`
                )
                .join('\n')}`,
            },
          ],
          response_format: zodResponseFormat(ClipsPrompt, 'clipsPrompt'),
        },
        // shorter than the activity: an attempt that was given up on must not
        // still be running, and storing clips, when its retry gets there
        { timeout: 8 * 60 * 1000, maxRetries: 0 }
      )
    ).choices[0].message.parsed || { clips: [] };

    return clips;
  }

  async generateImage(prompt: string, isVertical = false) {
    // gpt-image models always return base64 (b64_json) and do not accept the
    // `response_format` parameter, unlike the deprecated dall-e-3.
    const generate = (
      await openai.images.generate({
        prompt,
        model: 'chatgpt-image-latest',
        size: isVertical ? '1024x1536' : '1024x1024',
      })
    ).data[0];

    return generate.b64_json;
  }

  async generatePromptForPicture(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a description and style and generate a prompt that will be used later to generate images, make it a very long and descriptive explanation, and write a lot of things for the renderer like, if it${"'"}s realistic describe the camera`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(PicturePrompt, 'picturePrompt'),
        })
      ).choices[0].message.parsed?.prompt || ''
    );
  }

  async generateVoiceFromText(prompt: string) {
    return (
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that takes a social media post and convert it to a normal human voice, to be later added to a character, when a person talk they don\'t use "-", and sometimes they add pause with "..." to make it sounds more natural, make sure you use a lot of pauses and make it sound like a real person`,
            },
            {
              role: 'user',
              content: `prompt: ${prompt}`,
            },
          ],
          response_format: zodResponseFormat(VoicePrompt, 'voice'),
        })
      ).choices[0].message.parsed?.voice || ''
    );
  }

  async generatePosts(content: string) {
    const posts = (
      await Promise.all([
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a Twitter post from the content without emojis in the following JSON format: { "post": string } put it in an array with one element',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
        openai.chat.completions.create({
          messages: [
            {
              role: 'assistant',
              content:
                'Generate a thread for social media in the following JSON format: Array<{ "post": string }> without emojis',
            },
            {
              role: 'user',
              content: content!,
            },
          ],
          n: 5,
          temperature: 1,
          model: 'gpt-4.1',
        }),
      ])
    ).flatMap((p) => p.choices);

    return shuffle(
      posts.map((choice) => {
        const { content } = choice.message;
        const start = content?.indexOf('[')!;
        const end = content?.lastIndexOf(']')!;
        try {
          return JSON.parse(
            '[' +
              content
                ?.slice(start + 1, end)
                .replace(/\n/g, ' ')
                .replace(/ {2,}/g, ' ') +
              ']'
          );
        } catch (e) {
          return [];
        }
      })
    );
  }
  async extractWebsiteText(content: string) {
    const websiteContent = await openai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content:
            'You take a full website text, and extract only the article content',
        },
        {
          role: 'user',
          content,
        },
      ],
      model: 'gpt-4.1',
    });

    const { content: articleContent } = websiteContent.choices[0].message;

    return this.generatePosts(articleContent!);
  }

  async separatePosts(content: string, len: number) {
    const SeparatePostsPrompt = z.object({
      posts: z.array(z.string()),
    });

    const SeparatePostPrompt = z.object({
      post: z.string().max(len),
    });

    const posts =
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          messages: [
            {
              role: 'system',
              content: `You are an assistant that take a social media post and break it to a thread, each post must be minimum ${
                len - 10
              } and maximum ${len} characters, keeping the exact wording and break lines, however make sure you split posts based on context`,
            },
            {
              role: 'user',
              content: content,
            },
          ],
          response_format: zodResponseFormat(
            SeparatePostsPrompt,
            'separatePosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    return {
      posts: await Promise.all(
        posts.map(async (post: any) => {
          if (post.length <= len) {
            return post;
          }

          let retries = 4;
          while (retries) {
            try {
              return (
                (
                  await openai.chat.completions.parse({
                    model: 'gpt-4.1',
                    messages: [
                      {
                        role: 'system',
                        content: `You are an assistant that take a social media post and shrink it to be maximum ${len} characters, keeping the exact wording and break lines`,
                      },
                      {
                        role: 'user',
                        content: post,
                      },
                    ],
                    response_format: zodResponseFormat(
                      SeparatePostPrompt,
                      'separatePost'
                    ),
                  })
                ).choices[0].message.parsed?.post || ''
              );
            } catch (e) {
              retries--;
            }
          }

          return post;
        })
      ),
    };
  }

  async generateSlidesFromText(text: string) {
    for (let i = 0; i < 3; i++) {
      try {
        const message = `You are an assistant that takes a text and break it into slides, each slide should have an image prompt and voice text to be later used to generate a video and voice, image prompt should capture the essence of the slide and also have a back dark gradient on top, image prompt should not contain text in the picture, generate between 3-5 slides maximum`;
        const parse =
          (
            await openai.chat.completions.parse({
              model: 'gpt-4.1',
              messages: [
                {
                  role: 'system',
                  content: message,
                },
                {
                  role: 'user',
                  content: text,
                },
              ],
              response_format: zodResponseFormat(
                z.object({
                  slides: z
                    .array(
                      z.object({
                        imagePrompt: z.string(),
                        voiceText: z.string(),
                      })
                    )
                    .describe('an array of slides'),
                }),
                'slides'
              ),
            })
          ).choices[0].message.parsed?.slides || [];

        return parse;
      } catch (err) {
        console.log(err);
      }
    }

    return [];
  }

  // Uses the web search tool so the angles come from what is being talked
  // about right now and not from the model's training data
  async researchTrends(theme: string, language: string, count: number) {
    const research = await openai.responses.create({
      model: 'gpt-4.1',
      tools: [{ type: 'web_search' }],
      input: `Search the web for what is trending right now (the last days and weeks) about the theme "${theme}", for an audience that speaks ${language}.
Find ${count} different angles that would make a strong social media post today: recent news, launches, debates, data or viral discussions.
For every angle write a short title, two or three sentences with the concrete facts (names, numbers, dates) and the URLs of the sources you used.`,
    });

    return research.output_text;
  }

  async generateCampaignPosts(params: {
    theme: string;
    research: string;
    count: number;
    language: string;
    tone?: string;
    instructions?: string;
    platforms: string[];
  }) {
    const CampaignPostsPrompt = z.object({
      posts: z.array(
        z.object({
          trend: z
            .string()
            .describe('Short title of the trending angle the post is about'),
          sources: z
            .array(z.string())
            .describe('URLs from the research that back the post'),
          headline: z
            .string()
            .describe(
              'The hook: one short, punchy line that stops the scroll, max 110 characters'
            ),
          body: z
            .string()
            .describe(
              'The rest of the post, plain text, short paragraphs separated by an empty line'
            ),
          imagePrompt: z
            .string()
            .describe(
              'English description of a real photograph that illustrates the post'
            ),
        })
      ),
    });

    const posts =
      (
        await openai.chat.completions.parse({
          model: 'gpt-4.1',
          temperature: 0.9,
          messages: [
            {
              role: 'system',
              content: `You are a senior social media copywriter and former journalist who ghostwrites for founders and executives. Your posts get read because they sound like a sharp, well-informed person talking, never like a machine or a press release.

# Task
Using ONLY the facts in the research the user sends, write ${
                params.count
              } posts about the theme "${
                params.theme
              }". Each post covers a different trending angle from the research.
The posts will be published on: ${params.platforms.join(', ')}.
Write in this language, whatever the language of these instructions: ${
                params.language
              }. Write like a native speaker of that language would, with its natural idioms, not like a translation.${
                params.tone ? `\nTone of voice: ${params.tone}.` : ''
              }${
                params.instructions
                  ? `\nExtra instructions from the user (follow them): ${params.instructions}`
                  : ''
              }

# Structure of every post
1. headline: the hook, one line, max 110 characters. It is the most important part: it must stop someone scrolling. Use a concrete, surprising fact or number from the research, a bold claim you can back up, a tension or a contrast. It must make sense on its own and create curiosity to read the rest. No clickbait lies, no question marks as a lazy trick, no emojis, no hashtags.
2. body: shorter and calmer than the headline promise, it delivers the details. 2 to 4 short paragraphs separated by an empty line, 250 to 800 characters in total. Explain what happened, why it matters to the reader and one concrete takeaway or opinion. You may end with a genuine, specific question to the reader, but only if it is natural, never a generic "What do you think?". Up to 2 relevant hashtags on the last line, or none.

# Sound human, not AI (strict)
- Vary sentence length. Mix very short sentences with longer ones. Fragments are fine.
- Be specific: names, numbers, dates, places from the research. Specific beats generic every time.
- Take a point of view. A real person has an opinion, you can too, as long as the facts are right.
- Plain words. Write like you talk to a smart colleague.
- NEVER use these patterns or their equivalents in the target language: "In today's fast-paced world", "In an ever-evolving landscape", "Let's dive in", "delve", "unlock", "unleash", "game-changer", "revolutionize", "harness the power", "navigate the complexities", "it's not just X, it's Y", "the future is here", "buckle up", "here's the thing", "Imagine a world", "Did you know?" as an opener, "In conclusion", "Let's explore", "Neste post", "Vamos explorar", "No mundo atual", "cada vez mais" as filler, "revolucionário", "Descubra como".
- No lists of three adjectives or three parallel phrases in a row. No em dashes (—). No emoji bullets, at most one emoji in the whole post and only if it adds meaning.
- No bold or markdown, no headers, no "Key takeaways", no bullet lists: plain text only.
- Do not start two posts the same way.

# Facts
Never invent facts, numbers, quotes or names that are not in the research. If the research is thin on an angle, write a smaller claim instead of making something up. Put the URLs you used in sources.

# Image
For every post write imagePrompt in English: a scene a professional photographer could actually shoot today, directly connected to the post. Describe real people, a real place, real objects and what is happening: who, where, doing what, time of day and light, framing (close-up, medium shot, wide shot). Prefer candid, documentary moments over posed ones.
Never use abstract or symbolic concepts: no glowing brains, circuits, holograms, robots, rockets, light bulbs, puzzle pieces, handshakes in front of a skyline, people pointing at floating screens, futuristic cities. No text, letters, logos or readable screens in the scene: avoid whiteboards, charts, slides, projections, posters, documents or monitors with visible content; if a screen or paper appears it is turned away or out of focus.`,
            },
            {
              role: 'user',
              content: params.research,
            },
          ],
          response_format: zodResponseFormat(
            CampaignPostsPrompt,
            'campaignPosts'
          ),
        })
      ).choices[0].message.parsed?.posts || [];

    // Em dashes are the most recognisable sign of AI writing, the model
    // still slips one in from time to time
    const humanize = (text: string) => text.trim().replace(/\s*—\s*/g, ' - ');

    return posts.map(({ headline, body, ...post }) => ({
      ...post,
      content: `${humanize(headline)}\n\n${humanize(body)}`,
    }));
  }

  // Stories have no caption, the hook has to be written on the picture
  realisticStoryPrompt(scene: string, headline: string) {
    return `${this.realisticPhotoPrompt(scene, true)}

Exception to the no-text rule: this is a vertical Instagram Story. Add exactly this headline, spelled exactly like this, once, in the upper third of the image, inside a safe margin of 10% from every edge:
"${headline}"
Typography: bold, clean modern sans-serif (like Inter or Helvetica Neue), white letters, large and easy to read on a phone, left-aligned, at most 4 lines, on a subtle dark gradient over the photo so it stays legible. No other text, no logos, no stickers, no emojis. The photo itself must still follow every rule above.`;
  }

  // Wraps the scene written by generateCampaignPosts so the picture looks
  // like a real photograph and not like an AI render
  realisticPhotoPrompt(scene: string, isVertical = false) {
    return `A real, unretouched ${
      isVertical ? 'vertical (portrait orientation) ' : ''
    }photograph, indistinguishable from a picture taken by a professional photojournalist for a newspaper or a business magazine.

Scene: ${scene}

Photography:
- Shot on a full-frame camera (Sony A7 IV or Canon EOS R5) with a 35mm or 50mm prime lens, aperture around f/2.8, natural depth of field.
- Available, natural light only (window light, overcast daylight, office or street lights). Soft, believable shadows, realistic dynamic range, slightly imperfect exposure.
- Candid, unposed moment, as if the subject did not notice the camera. Slightly off-center, natural framing, a little of the surroundings cut at the edges.
- True-to-life, neutral colors, like a straight-out-of-camera JPEG. No color grading, no teal and orange, not oversaturated, not HDR.
- Subtle sensor noise and fine grain, tiny lens imperfections, real micro-details.

People (if any):
- Ordinary, diverse, real-looking people of different ages and body types, not models.
- Natural skin with pores, fine lines, small blemishes and uneven tones. Real hair with flyaways. Natural, relaxed expressions, not smiling at the camera.
- Everyday clothes with wrinkles and folds. Hands with five natural fingers doing something plausible.

Environment:
- A real place with everyday clutter and wear: cables, papers, coffee cups, scuffs, fingerprints, uneven surfaces.

It must NOT look like: a 3D render, CGI, digital art, an illustration, a painting, a stock photo, an advertisement or a movie still. No plastic or airbrushed skin, no perfect symmetry, no glowing or neon light, no lens flares, no dramatic cinematic lighting, no futuristic or sci-fi elements. No text, letters, numbers, logos, watermarks or readable screens anywhere in the image.`;
  }
}
