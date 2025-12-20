import { useState, useEffect } from 'react';
import { motion, AnimatePresence, LayoutGroup } from 'framer-motion';
import { X, MapPin, ChevronRight, ArrowLeft, Loader2 } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';
import { marked } from 'marked';

// 研究数据接口
interface ResearchItem {
  id: string;
  slug: string;
  title: string;
  location: string;
  summary: string;
  tags: string[];
}

// 研究详情接口
interface ResearchDetail extends ResearchItem {
  content: string;  // 已转换为 HTML 的内容
  cover?: string;
  date?: string;
}

// 模拟研究数据
const RESEARCH_ITEMS: ResearchItem[] = [
  {
    id: 'research-001',
    slug: 'haidian-creek',
    title: '海甸溪变迁',
    location: '海甸溪沿岸',
    summary: '记录海甸溪从2000年到2024年的河道变化与生态恢复情况。',
    tags: ['水文', '生态'],
  },
  {
    id: 'research-002',
    slug: 'baishamen-park',
    title: '白沙门公园',
    location: '白沙门区域',
    summary: '白沙门从滩涂到公园的城市化进程研究。',
    tags: ['城市化', '休闲'],
  },
  {
    id: 'research-003',
    slug: 'century-bridge',
    title: '世纪大桥建设',
    location: '世纪大桥',
    summary: '世纪大桥的建设对海甸岛交通和发展的影响分析。',
    tags: ['交通', '基建'],
  },
];

// 侧栏宽度常量
const SIDEBAR_WIDTH_EXPANDED = '16rem'; // 64 * 4 = 256px = 16rem
const SIDEBAR_WIDTH_COLLAPSED = '4.5rem';

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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [selectedResearch, setSelectedResearch] = useState<ResearchDetail | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { setSelectedMarker, isResearchPanelOpen, setResearchPanelOpen, openResearchSlug, setOpenResearchSlug } = useMapStore();

  // 面板打开/关闭状态
  const isOpen = isResearchPanelOpen;
  const setIsOpen = setResearchPanelOpen;

  // 监听侧栏状态变化
  useEffect(() => {
    const checkSidebarState = () => {
      const sidebar = document.getElementById('sidebar');
      if (sidebar) {
        setSidebarCollapsed(sidebar.classList.contains('collapsed'));
      }
    };

    // 初始检查
    checkSidebarState();

    // 从 localStorage 读取初始状态
    const isCollapsed = localStorage.getItem('sidebar-collapsed') === 'true';
    setSidebarCollapsed(isCollapsed);

    // 监听侧栏的 class 变化
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
          if (mutation.attributeName === 'class') {
            checkSidebarState();
          }
        });
      });
      observer.observe(sidebar, { attributes: true });
      return () => observer.disconnect();
    }
  }, []);

  // 监听 openResearchSlug 变化，自动打开对应研究
  useEffect(() => {
    if (openResearchSlug && isOpen) {
      const item = RESEARCH_ITEMS.find(r => r.slug === openResearchSlug);
      if (item) {
        setExpandedId(item.id);
        loadResearchContent(item);
      }
      // 清除 slug，避免重复触发
      setOpenResearchSlug(null);
    }
  }, [openResearchSlug, isOpen]);

  const sidebarWidth = sidebarCollapsed ? SIDEBAR_WIDTH_COLLAPSED : SIDEBAR_WIDTH_EXPANDED;

  // 加载研究详情内容
  const loadResearchContent = async (item: ResearchItem) => {
    setIsLoading(true);
    setSelectedMarker(item.id);
    
    try {
      // 从服务器获取 markdown 内容
      const response = await fetch(`/api/research/${item.slug}.json`);
      
      if (response.ok) {
        const data = await response.json();
        setSelectedResearch({
          ...item,
          content: data.content,  // API 已返回 HTML
          cover: data.cover,
          date: data.date,
        });
      } else {
        // 如果 API 不可用，尝试直接获取 markdown 文件
        const mdResponse = await fetch(`/research-content/${item.slug}.md`);
        if (mdResponse.ok) {
          const markdown = await mdResponse.text();
          const { content } = parseFrontmatter(markdown);
          const htmlContent = await marked(content);
          setSelectedResearch({
            ...item,
            content: htmlContent as string,
          });
        } else {
          // 使用默认内容
          const defaultContent = await marked(`# ${item.title}\n\n${item.summary}\n\n*详细内容正在整理中...*`);
          setSelectedResearch({
            ...item,
            content: defaultContent as string,
          });
        }
      }
    } catch (error) {
      console.error('加载研究内容失败:', error);
      // 使用默认内容
      const defaultContent = await marked(`# ${item.title}\n\n${item.summary}\n\n*详细内容正在整理中...*`);
      setSelectedResearch({
        ...item,
        content: defaultContent as string,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleItemClick = (item: ResearchItem) => {
    setExpandedId(item.id);
    loadResearchContent(item);
  };

  const handleBackToList = () => {
    setExpandedId(null);
    setSelectedResearch(null);
  };

  // 渲染卡片内容（列表模式）
  const renderCardContent = (item: ResearchItem, isExpanded: boolean) => (
    <>
      <div className="flex items-start justify-between">
        <motion.h3 
          layout="position"
          className={`font-medium text-neutral-14 ${isExpanded ? 'text-lg' : ''}`}
        >
          {item.title}
        </motion.h3>
        {!isExpanded && (
          <ChevronRight size={14} className="text-neutral-6 group-hover:text-primary-6 flex-shrink-0" />
        )}
      </div>
      
      <motion.div layout="position" className="flex items-center gap-1 mt-1 text-sm text-neutral-10">
        <MapPin size={12} />
        <span>{item.location}</span>
      </motion.div>
      
      {!isExpanded && (
        <p className="mt-2 text-sm text-neutral-12 line-clamp-2">
          {item.summary}
        </p>
      )}
      
      {/* <motion.div layout="position" className="flex gap-2 mt-2">
        {item.tags.map((tag) => (
          <span
            key={tag}
            className="px-2 py-0.5 text-xs bg-primary-2 text-primary-8 rounded-full"
          >
            {tag}
          </span>
        ))}
      </motion.div> */}
    </>
  );

  return (
    <>
      {/* 触发按钮 */}
      <motion.button
        initial={{ x: -100 }}
        animate={{ x: 0, left: sidebarWidth }}
        transition={{ duration: 0.3 }}
        onClick={() => setIsOpen(true)}
        className="flex fixed flex-row top-1/2 -translate-y-1/2 z-20 bg-white shadow-lg rounded-r-lg px-4 py-3 hover:bg-neutral-2 transition-colors  [writing-mode:vertical-lr] "
        style={{ left: sidebarWidth }}
        aria-label="打开研究面板"
      >
        <ChevronRight size={20} className="text-neutral-12" />
        <span className="writing-vertical text-sm text-neutral-12 mt-2">研究列表</span>
      </motion.button>

      {/* 研究面板 */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ x: -400, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -400, opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="fixed top-0 h-full w-96 bg-white shadow-xl z-30 overflow-hidden"
            style={{ left: sidebarWidth }}
          >
            <LayoutGroup>
              {/* 面板头部 */}
              <div className="flex items-center justify-between p-4 border-b border-neutral-3">
                <AnimatePresence mode="wait">
                  {expandedId ? (
                    <motion.button
                      key="back"
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -10 }}
                      transition={{ duration: 0.15 }}
                      onClick={handleBackToList}
                      className="w-8 h-8 rounded-md hover:bg-neutral-3 flex items-center justify-center transition-colors"
                      aria-label="返回列表"
                    >
                      <ArrowLeft size={18} />
                    </motion.button>
                  ) : (
                    <motion.h2 
                      key="title"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      className="text-lg font-semibold text-neutral-14"
                    >
                      研究展示
                    </motion.h2>
                  )}
                </AnimatePresence>
                <div className="flex items-center gap-2">
                  <AnimatePresence>
                    {expandedId && selectedResearch && (
                      <motion.a
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        transition={{ duration: 0.15 }}
                        href={`/research/${selectedResearch.slug}`}
                        className="px-3 py-1.5 text-sm bg-primary-6 hover:bg-primary-7 text-white rounded-md transition-colors"
                      >
                        查看完整页面
                      </motion.a>
                    )}
                  </AnimatePresence>
                  <button
                    onClick={() => setIsOpen(false)}
                    className="w-8 h-8 rounded-md hover:bg-neutral-3 flex items-center justify-center transition-colors"
                    aria-label="关闭面板"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {/* 内容区域 */}
              <div className="flex-1 overflow-hidden relative" style={{ height: 'calc(100% - 65px)' }}>
                {/* 卡片列表 */}
                <motion.div 
                  className="absolute inset-0 overflow-y-auto  "
                  animate={{ opacity: expandedId ? 0 : 1 }}
                  transition={{ duration: 0.15 }}
                  style={{ pointerEvents: expandedId ? 'none' : 'auto' }}
                >
                  {RESEARCH_ITEMS.map((item) => (
                    <motion.div
                      key={item.id}
                      layoutId={`card-${item.id}`}
                      onClick={() => !expandedId && handleItemClick(item)}
                      className="p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-100 transition-colors group"
                      whileHover={!expandedId ? { scale: 1 } : {}}
                      whileTap={!expandedId ? { scale: 1 } : {}}
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      {renderCardContent(item, false)}
                    </motion.div>
                  ))}
                </motion.div>

                {/* 展开的卡片详情 */}
                <AnimatePresence>
                  {expandedId && (
                    <motion.div
                      layoutId={`card-${expandedId}`}
                      className="absolute inset-0 bg-white rounded-t-lg overflow-hidden flex flex-col"
                      transition={{ type: 'spring', stiffness: 400, damping: 30 }}
                    >
                      {/* 内容区域 */}
                      {isLoading ? (
                        <div className="flex-1 flex items-center justify-center">
                          <Loader2 size={32} className="animate-spin text-primary-6" />
                        </div>
                      ) : selectedResearch ? (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          transition={{ delay: 0.1, duration: 0.2 }}
                          className="flex-1 overflow-y-auto p-4 prose prose-sm max-w-none
                            prose-headings:text-neutral-14 prose-headings:font-semibold
                            prose-h1:text-xl prose-h1:mb-4 prose-h1:mt-0
                            prose-h2:text-lg prose-h2:mb-3 prose-h2:mt-6
                            prose-h3:text-base prose-h3:mb-2 prose-h3:mt-4
                            prose-p:text-neutral-12 prose-p:leading-relaxed prose-p:mb-3
                            prose-ul:my-2 prose-li:text-neutral-12
                            prose-strong:text-neutral-14"
                          dangerouslySetInnerHTML={{ __html: selectedResearch.content }}
                        />
                      ) : null}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </LayoutGroup>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
