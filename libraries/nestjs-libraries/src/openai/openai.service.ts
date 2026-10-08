import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { shuffle } from 'lodash';
import { zodResponseFormat } from 'openai/helpers/zod';
import { z } from 'zod';
import { CarouselSlide } from '@gitroom/nestjs-libraries/carousels/carousel.template';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'sk-proj-',
});

// Models used by AI campaigns, the user picks one tier per campaign
export const AI_CAMPAIGN_TIERS = {
  premium: {
    text: 'gpt-4.1',
    image: 'chatgpt-image-latest',
    imageQuality: 'auto',
  },
  economy: {
    text: 'gpt-4.1-mini',
    image: 'gpt-image-1-mini',
    imageQuality: 'medium',
  },
} as const;
export type AiCampaignTier = keyof typeof AI_CAMPAIGN_TIERS;

// USD per 1M tokens, https://developers.openai.com/api/docs/pricing
const TEXT_PRICES: Record<string, { input: number; output: number }> = {
  'gpt-4.1': { input: 2, output: 8 },
  'gpt-4.1-mini': { input: 0.4, output: 1.6 },
};
const IMAGE_PRICES: Record<
  string,
  { text: number; image: number; output: number }
> = {
  'chatgpt-image-latest': { text: 5, image: 8, output: 32 },
  'gpt-image-1-mini': { text: 2, image: 2.5, output: 8 },
};
const WEB_SEARCH_CALL_PRICE = 0.01;

const textCost = (model: string, input = 0, output = 0) =>
  (input * TEXT_PRICES[model].input + output * TEXT_PRICES[model].output) /
  1_000_000;

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
  async researchTrends(
    theme: string,
    language: string,
    count: number,
    tier: AiCampaignTier = 'premium'
  ) {
    const model = AI_CAMPAIGN_TIERS[tier].text;
    const research = await openai.responses.create({
      model,
      tools: [{ type: 'web_search' }],
      input: `Search the web for what is trending right now (the last days and weeks) about the theme "${theme}", for an audience that speaks ${language}.
Find ${count} different angles that would make a strong social media post today: recent news, launches, debates, data or viral discussions.
For every angle write a short title, two or three sentences with the concrete facts (names, numbers, dates) and the URLs of the sources you used.`,
    });

    const searches = research.output.filter(
      (item) => item.type === 'web_search_call'
    ).length;

    return {
      text: research.output_text,
      cost:
        searches * WEB_SEARCH_CALL_PRICE +
        textCost(
          model,
          research.usage?.input_tokens,
          research.usage?.output_tokens
        ),
    };
  }

  // Same as generateImage but with the campaign tier model and the real cost
  // of the picture, computed from the usage OpenAI returns
  async generateCampaignImage(
    prompt: string,
    isVertical: boolean,
    tier: AiCampaignTier = 'premium'
  ) {
    const { image: model, imageQuality } = AI_CAMPAIGN_TIERS[tier];
    const generate = await openai.images.generate({
      prompt,
      model,
      quality: imageQuality,
      size: isVertical ? '1024x1536' : '1024x1024',
    });
    const usage = generate.usage;
    const prices = IMAGE_PRICES[model];

    return {
      b64: generate.data![0].b64_json!,
      cost:
        ((usage?.input_tokens_details?.text_tokens || 0) * prices.text +
          (usage?.input_tokens_details?.image_tokens || 0) * prices.image +
          (usage?.output_tokens || 0) * prices.output) /
        1_000_000,
    };
  }

  async generateCampaignPosts(params: {
    theme: string;
    research: string;
    count: number;
    language: string;
    tone?: string;
    instructions?: string;
    platforms: string[];
    tier?: AiCampaignTier;
  }) {
    const model = AI_CAMPAIGN_TIERS[params.tier || 'premium'].text;
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

    const completion = await openai.chat.completions.parse({
          model,
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
        });
    const posts = completion.choices[0].message.parsed?.posts || [];

    // Em dashes are the most recognisable sign of AI writing, the model
    // still slips one in from time to time
    const humanize = (text: string) => text.trim().replace(/\s*—\s*/g, ' - ');

    return {
      cost: textCost(
        model,
        completion.usage?.prompt_tokens,
        completion.usage?.completion_tokens
      ),
      posts: posts.map(({ headline, body, ...post }) => ({
        ...post,
        content: `${humanize(headline)}\n\n${humanize(body)}`,
      })),
    };
  }

  // ---------- AI carousels (the carousel studio guide, step by step) ----------

  // Step 7: read the article (or find the strongest trending story) and open
  // the original source to check every number
  async researchCarousel(params: {
    url?: string;
    theme?: string;
    language: string;
    tier?: AiCampaignTier;
  }) {
    const model = AI_CAMPAIGN_TIERS[params.tier || 'premium'].text;
    const start = params.url
      ? `Open and read this article: ${params.url}`
      : `Search the web for what is trending right now (the last days) about "${params.theme}" for an audience that speaks ${params.language}, and pick the single strongest recent story`;
    const research = await openai.responses.create({
      model,
      tools: [{ type: 'web_search' }],
      input: `${start}.
Then you MUST search for and open the ORIGINAL source the story is based on (the study, paper, official press release of the university or company, official announcement) and check every number, name and date against it. A news article is never the original source. If you cannot find the original, write "ORIGINAL NOT FOUND" in DIVERGENCES.
Answer in ${params.language} with these sections:
TOPIC: one line
FACTS: bullet list, each fact with exact numbers, names and dates, followed by the URL where you confirmed it (prefer the original source)
DIVERGENCES: where the article and the original source disagree, and claims of the article the original does not confirm (or "none")
LIMITATIONS: caveats, what is not proven yet
QUOTES: exact quotes with their author, original language and a faithful translation
SOURCES: every URL you used, with title and date
Never write a number that is not in the sources.`,
    });
    const searches = research.output.filter(
      (item) => item.type === 'web_search_call'
    ).length;

    return {
      text: research.output_text,
      cost:
        searches * WEB_SEARCH_CALL_PRICE +
        textCost(model, research.usage?.input_tokens, research.usage?.output_tokens),
    };
  }

  // Step 7 tip: 5 cover hooks, from the safest to the boldest
  async generateCarouselHooks(params: {
    research: string;
    language: string;
    audience?: string;
    tier?: AiCampaignTier;
  }) {
    const model = AI_CAMPAIGN_TIERS[params.tier || 'premium'].text;
    const completion = await openai.chat.completions.parse({
      model,
      temperature: 0.9,
      messages: [
        {
          role: 'system',
          content: `You write cover hooks for social media carousels. Using only the research, write 5 hooks for the cover, ordered from the safest to the boldest.
Each hook: max 80 characters, understood in 2 seconds, makes the reader stop scrolling. A hook never claims more than the research says (no "before you complain", "reads your mind", "in seconds" if the source does not say so). Talk to the reader ("você", "seu"), create curiosity or tension, use a concrete image or contrast instead of technical jargon (e.g. "Seu cérebro sabe que a IA errou antes de você reclamar." beats "Novo algoritmo usa sinais cerebrais para treinar IA").
Hook 1 is safe and informative, hook 5 is bold but still true. No clickbait lies, no emojis, no em dashes.
Write them in this language: ${params.language}.${
            params.audience ? ` Audience: ${params.audience}.` : ''
          }`,
        },
        { role: 'user', content: params.research },
      ],
      response_format: zodResponseFormat(
        z.object({ hooks: z.array(z.string()) }),
        'carouselHooks'
      ),
    });

    return {
      hooks: (completion.choices[0].message.parsed?.hooks || []).slice(0, 5),
      cost: textCost(
        model,
        completion.usage?.prompt_tokens,
        completion.usage?.completion_tokens
      ),
    };
  }

  private carouselSlidesFormat() {
    const column = z
      .object({ titulo: z.string(), itens: z.array(z.string()) })
      .nullable();
    return zodResponseFormat(
      z.object({
        slides: z.array(
          z.object({
            type: z.enum([
              'capa',
              'texto',
              'lista',
              'numero',
              'colunas',
              'citacao',
              'salvar',
              'fechamento',
            ]),
            fundo: z.enum(['claro', 'escuro', 'cor']),
            rotulo: z.string().nullable(),
            titulo: z.string(),
            destaque: z.string().nullable(),
            subtitulo: z.string().nullable(),
            itens: z.array(z.string()).nullable(),
            numero: z.string().nullable(),
            colunaA: column,
            colunaB: column,
            citacao: z.string().nullable(),
            autor: z.string().nullable(),
            fonte: z.string().nullable(),
            foto: z.string().nullable(),
          })
        ),
      }),
      'carouselSlides'
    );
  }

  private carouselSlidesRules(params: {
    slides: number;
    language: string;
    audience?: string;
    emotions: string[];
  }) {
    return `You design Instagram and LinkedIn carousels (1080x1350 slides) for a personal brand, following these rules strictly.
Write in this language: ${params.language}.${
      params.audience ? ` Audience: ${params.audience}.` : ''
    }
Exactly ${params.slides} slides, in this order: cover with the hook, context, development (one or more slides), a "save this" slide and a closing slide.
ONE SLIDE, ONE IDEA. Short text: titles up to 70 characters, at most 4 list items of up to 90 characters each.
Every slide must teach something concrete from the research (what happened, how it works, an example, what it means for the reader). No filler like "published in a renowned journal" or "promising results".
Unused fields are null, never an empty string.

Slide types and the fields they use (every other field is null):
- capa (first slide, fundo "claro"): rotulo = 2 or 3 word tag, titulo = the hook, destaque, subtitulo = one line promise ending with "→", foto
- texto: rotulo, titulo, destaque, subtitulo (2 short sentences), foto
- lista: rotulo, titulo, destaque, itens, fonte
- numero: ONLY if the research has that exact number. rotulo, titulo, destaque, numero (as written in the source, e.g. "29,2%"), subtitulo = what it means, fonte = source name and year, foto
- colunas: comparison, rotulo, titulo, destaque, colunaA and colunaB {titulo, itens (2 or 3)}, fonte; foto is null
- citacao: ONLY when QUOTES has an exact sentence said by a named person (researcher, executive), at most 160 characters (cut it with "(...)" if needed). citacao (faithful translation), autor (name, role, add "(tradução livre)" when translated), rotulo, foto. Never quote a news outlet, never paraphrase inside quotes; without a real quote use another type
- salvar (second to last): titulo, destaque, itens = 3 or 4 takeaways, the main limitation of the research as the last item when there is one, fonte
- fechamento (last): titulo like "Salva pra não perder.", destaque, subtitulo = a genuine question to the reader, foto

rotulo of development slides is numbered like "01 · O que aconteceu", "02 · ...".
destaque must be an EXACT substring of titulo, same case and accents (2 to 4 words to highlight).
Use the original source (not the news article) for every claim; ignore claims listed in DIVERGENCES as not confirmed.
fundo: vary between "claro", "escuro" and "cor"; use "cor" at most once.
foto: the emotion of the photo for the slide, one of: ${
      params.emotions.length ? params.emotions.join(', ') : 'nenhuma'
    }, or "nenhuma". Never repeat the same emotion on consecutive slides.
Facts: never invent numbers, names, dates or quotes; everything comes from the research. Never claim more than the source says. If something was only tested in simulation or is preliminary, say it.
Sound human: no "No mundo atual", "Descubra como", "revolucionário", no em dashes (—), no lists of three adjectives.`;
  }

  // Steps 5, 7 and 8: the content of every slide, as JSON for the template
  async generateCarouselSlides(params: {
    research: string;
    hook: string;
    slides: number;
    language: string;
    audience?: string;
    emotions: string[];
    tier?: AiCampaignTier;
  }) {
    const model = AI_CAMPAIGN_TIERS[params.tier || 'premium'].text;
    const completion = await openai.chat.completions.parse({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: this.carouselSlidesRules(params) },
        {
          role: 'user',
          content: `Cover hook chosen by the user: ${params.hook}\n\nResearch:\n${params.research}`,
        },
      ],
      response_format: this.carouselSlidesFormat(),
    });

    return {
      slides: (completion.choices[0].message.parsed?.slides ||
        []) as CarouselSlide[],
      cost: textCost(
        model,
        completion.usage?.prompt_tokens,
        completion.usage?.completion_tokens
      ),
    };
  }

  // "Pedir ajuste": applies the user's instruction to the slides
  async reviseCarouselSlides(params: {
    research: string;
    current: CarouselSlide[];
    instruction: string;
    language: string;
    audience?: string;
    emotions: string[];
    tier?: AiCampaignTier;
  }) {
    const model = AI_CAMPAIGN_TIERS[params.tier || 'premium'].text;
    const completion = await openai.chat.completions.parse({
      model,
      temperature: 0.4,
      messages: [
        {
          role: 'system',
          content: `${this.carouselSlidesRules({
            ...params,
            slides: params.current.length,
          })}

You receive the current slides as JSON and an instruction from the user. Apply ONLY what the instruction asks and keep everything else exactly the same.`,
        },
        {
          role: 'user',
          content: `Instruction: ${params.instruction}\n\nCurrent slides:\n${JSON.stringify(
            params.current
          )}\n\nResearch:\n${params.research}`,
        },
      ],
      response_format: this.carouselSlidesFormat(),
    });

    return {
      slides: (completion.choices[0].message.parsed?.slides ||
        params.current) as CarouselSlide[],
      cost: textCost(
        model,
        completion.usage?.prompt_tokens,
        completion.usage?.completion_tokens
      ),
    };
  }

  // Step 10: the caption, in the standard of the brand
  async generateCarouselCaption(params: {
    research: string;
    slides: CarouselSlide[];
    language: string;
    size: string;
    tone: string;
    emojis: number;
    hashtags: number;
    tier?: AiCampaignTier;
  }) {
    const model = AI_CAMPAIGN_TIERS[params.tier || 'premium'].text;
    const length =
      { curta: '300 to 500', media: '600 to 1200', longa: '1200 to 2000' }[
        params.size
      ] || '600 to 1200';
    const completion = await openai.chat.completions.parse({
      model,
      temperature: 0.8,
      messages: [
        {
          role: 'system',
          content: `Write the caption of this social media carousel in ${params.language}.
Length: ${length} characters before the sources. Tone: ${params.tone}.
The strongest fact in the first line. Short paragraphs of 1 to 3 sentences. End with a genuine, specific question to the reader.
Emojis: at most ${params.emojis} in the whole text${params.emojis === 0 ? ' (none)' : ''}.
Then a line starting with "Fontes:" citing the original sources (title, publication, date).
Last line: exactly ${params.hashtags} relevant hashtags.
Only facts from the research. No em dashes (—), no "No mundo atual", "Descubra como", "revolucionário".`,
        },
        {
          role: 'user',
          content: `Slides:\n${JSON.stringify(params.slides)}\n\nResearch:\n${params.research}`,
        },
      ],
      response_format: zodResponseFormat(
        z.object({ caption: z.string() }),
        'carouselCaption'
      ),
    });

    return {
      caption: (completion.choices[0].message.parsed?.caption || '')
        .trim()
        .replace(/\s*—\s*/g, ' - '),
      cost: textCost(
        model,
        completion.usage?.prompt_tokens,
        completion.usage?.completion_tokens
      ),
    };
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
