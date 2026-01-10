import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Loader2, ExternalLink, Play } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { marked } from 'marked';

// 研究详情接口
interface ResearchDetail {
  slug: string;
  title: string;
  location: string;
  content: string;
  cover?: string;
  date?: string;
}

// SVG 动画数据接口
interface SvgSlide {
  id: string;
  svg: string;
  title: string;
  annotation: string;
  duration: number;
  markerId: string | null;
}

interface SvgStage {
  id: string;
  name: string;
  description: string;
  slides: SvgSlide[];
}

interface SvgAnimationsData {
  stages: SvgStage[];
}

// 默认展示的研究 slug
const DEFAULT_RESEARCH_SLUG = 'all-in-one';

// 解析 markdown frontmatter
function parseFrontmatter(markdown: string): { frontmatter: Record<string, any>; content: string } {
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = markdown.match(frontmatterRegex);
  
  if (!match) {
    return { frontmatter: {}, content: markdown };
  }
  
  const frontmatterStr = match[1];
  const content = match[2];
  
  // 简单解析 YAML frontmatter
  const frontmatter: Record<string, any> = {};
  frontmatterStr.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      const value = line.slice(colonIndex + 1).trim();
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, content };
}

export default function ResearchPanel() {
  const [research, setResearch] = useState<ResearchDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [svgAnimations, setSvgAnimations] = useState<SvgAnimationsData | null>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const { isResearchPanelOpen, setSvgPlayerOpen, setCurrentStage } = useMapStore();

  // 组件加载时自动加载默认研究内容和 SVG 动画数据
  useEffect(() => {
    loadResearchContent(DEFAULT_RESEARCH_SLUG);
    loadSvgAnimations();
  }, []);

  // 加载 SVG 动画数据
  const loadSvgAnimations = async () => {
    try {
      const response = await fetch('/data/svg-animations.json');
      if (response.ok) {
        const data = await response.json();
        setSvgAnimations(data);
      } else {
        console.error('加载 SVG 动画数据失败: HTTP', response.status);
      }
    } catch (error) {
      console.error('加载 SVG 动画数据失败:', error);
    }
  };

  // 打开 SVG 动画播放器
  const openSvgPlayer = useCallback((stageId: string) => {
    if (!svgAnimations) {
      console.log('svgAnimations 未加载');
      return;
    }
    const stage = svgAnimations.stages.find(s => s.id === stageId);
    if (stage) {
      console.log('打开阶段:', stage.name);
      setCurrentStage(stage);
      setSvgPlayerOpen(true);
    } else {
      console.log('未找到阶段:', stageId);
    }
  }, [svgAnimations, setCurrentStage, setSvgPlayerOpen]);

  // 处理文章内按钮点击
  useEffect(() => {
    if (!contentRef.current) return;

    const handleButtonClick = (e: Event) => {
      const target = e.target as HTMLElement;
      const button = target.closest('[data-svg-stage]');
      if (button) {
        const stageId = button.getAttribute('data-svg-stage');
        if (stageId) {
          openSvgPlayer(stageId);
        }
      }
    };

    contentRef.current.addEventListener('click', handleButtonClick);
    return () => {
      contentRef.current?.removeEventListener('click', handleButtonClick);
    };
  }, [openSvgPlayer]);

  // 加载研究详情内容
  const loadResearchContent = async (slug: string) => {
    setIsLoading(true);
    
    try {
      // 从服务器获取 markdown 内容
      const response = await fetch(`/api/research/${slug}.json`);
      
      if (response.ok) {
        const data = await response.json();
        setResearch({
          slug,
          title: data.title || '研究展示',
          location: data.location || '',
          content: data.content,
          cover: data.cover,
          date: data.date,
        });
      } else {
        // 如果 API 不可用，尝试直接获取 markdown 文件
        const mdResponse = await fetch(`/research-content/${slug}.md`);
        if (mdResponse.ok) {
          const markdown = await mdResponse.text();
          const { frontmatter, content } = parseFrontmatter(markdown);
          const htmlContent = await marked(content);
          setResearch({
            slug,
            title: frontmatter.title || '研究展示',
            location: frontmatter.location || '',
            content: htmlContent as string,
            cover: frontmatter.cover,
            date: frontmatter.date,
          });
        } else {
          // 使用默认内容
          const defaultContent = await marked(`# 研究展示\n\n*内容正在整理中...*`);
          setResearch({
            slug,
            title: '研究展示',
            location: '',
            content: defaultContent as string,
          });
        }
      }
    } catch (error) {
      console.error('加载研究内容失败:', error);
      const defaultContent = await marked(`# 研究展示\n\n*加载失败，请稍后重试...*`);
      setResearch({
        slug,
        title: '研究展示',
        location: '',
        content: defaultContent as string,
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!isResearchPanelOpen) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 h-full w-96 bg-white/80 backdrop-blur-xl border-r border-neutral-3 overflow-hidden z-40 flex flex-col">
      {/* 面板头部 */}
      <div className="flex items-center justify-between p-4 border-b border-neutral-3 shrink-0">
        <h2 className="text-lg font-semibold text-neutral-14">
          {research?.title || '研究展示'}
        </h2>
      </div>

      {/* 内容区域 */}
      <div className="flex-1 overflow-hidden">
        {isLoading ? (
          <div className="h-full flex items-center justify-center">
            <Loader2 size={32} className="animate-spin text-primary-6" />
          </div>
        ) : research ? (
          <motion.div
            ref={contentRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.2 }}
            className="h-full overflow-y-auto p-4 prose prose-sm max-w-none
              prose-headings:text-neutral-14 prose-headings:font-semibold
              prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-0
              prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-6
              prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4
              prose-p:text-neutral-12 prose-p:leading-relaxed prose-p:mb-3
              prose-ul:my-2 prose-li:text-neutral-12
              prose-strong:text-neutral-14"
            dangerouslySetInnerHTML={{ __html: research.content }}
          />
        ) : null}
      </div>
    </div>
  );
}
