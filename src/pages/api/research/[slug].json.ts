import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { marked } from 'marked';

export const GET: APIRoute = async ({ params }) => {
  const { slug } = params;
  
  try {
    const researchCollection = await getCollection('research');
    const entry = researchCollection.find(item => item.slug === slug);
    
    if (!entry) {
      return new Response(
        JSON.stringify({ error: '研究内容未找到' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }
    
    // 获取渲染后的内容
    const { Content } = await entry.render();
    
    // 将 markdown 转换为 HTML
    const htmlContent = await marked(entry.body);
    
    return new Response(
      JSON.stringify({
        slug: entry.slug,
        title: entry.data.title,
        location: entry.data.location,
        summary: entry.data.summary,
        tags: entry.data.tags,
        cover: entry.data.cover,
        date: entry.data.date.toISOString(),
        content: htmlContent,
      }),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json' } 
      }
    );
  } catch (error) {
    console.error('获取研究内容失败:', error);
    return new Response(
      JSON.stringify({ error: '服务器内部错误' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};

// 生成静态路径
export async function getStaticPaths() {
  const researchCollection = await getCollection('research');
  return researchCollection.map(entry => ({
    params: { slug: entry.slug },
  }));
}
