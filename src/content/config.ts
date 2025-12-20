import { defineCollection, z } from 'astro:content';

const researchCollection = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    location: z.string(),
    summary: z.string(),
    tags: z.array(z.string()),
    cover: z.string(),
    date: z.coerce.date(),
  }),
});

export const collections = {
  research: researchCollection,
};
