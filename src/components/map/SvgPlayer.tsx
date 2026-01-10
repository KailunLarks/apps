import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, Play, Pause, MapPin } from 'lucide-react';
import { useMapStore } from '../../stores/mapStore';

// SVG 幻灯片接口
interface SvgSlide {
  id: string;
  svg: string;
  title: string;
  annotation: string;
  duration: number;
  markerId: string | null;
}

// SVG 阶段接口
interface SvgStage {
  id: string;
  name: string;
  description: string;
  slides: SvgSlide[];
}

export default function SvgPlayer() {
  const {
    isSvgPlayerOpen,
    setSvgPlayerOpen,
    currentStage,
    setCurrentStage,
    currentSlideIndex,
    setCurrentSlideIndex,
    isAutoPlay,
    setAutoPlay,
    flyToMarker,
  } = useMapStore();

  const [svgContent, setSvgContent] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // 获取当前幻灯片
  const currentSlide = currentStage?.slides[currentSlideIndex] || null;

  // 加载 SVG 内容
  useEffect(() => {
    if (!currentSlide) {
      setSvgContent('');
      return;
    }

    const loadSvg = async () => {
      setIsLoading(true);
      try {
        const response = await fetch(currentSlide.svg);
        if (response.ok) {
          const text = await response.text();
          setSvgContent(text);
        } else {
          // 如果 SVG 不存在，显示占位符
          setSvgContent(`
            <svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg">
              <rect width="400" height="300" fill="#f3f4f6"/>
              <text x="200" y="150" text-anchor="middle" fill="#9ca3af" font-size="14">
                ${currentSlide.title}
              </text>
              <text x="200" y="175" text-anchor="middle" fill="#d1d5db" font-size="12">
                (SVG 待添加)
              </text>
            </svg>
          `);
        }
      } catch (error) {
        console.error('加载 SVG 失败:', error);
        setSvgContent('');
      } finally {
        setIsLoading(false);
      }
    };

    loadSvg();
  }, [currentSlide]);

  // 自动播放逻辑
  useEffect(() => {
    if (!isAutoPlay || !currentStage || !currentSlide) return;

    const timer = setTimeout(() => {
      goToNext();
    }, currentSlide.duration);

    return () => clearTimeout(timer);
  }, [isAutoPlay, currentSlideIndex, currentStage, currentSlide]);

  // 跳转到关联的标记点
  useEffect(() => {
    if (currentSlide?.markerId) {
      flyToMarker(currentSlide.markerId);
    }
  }, [currentSlide, flyToMarker]);

  // 导航函数
  const goToNext = useCallback(() => {
    if (!currentStage) return;
    const nextIndex = (currentSlideIndex + 1) % currentStage.slides.length;
    setCurrentSlideIndex(nextIndex);
  }, [currentStage, currentSlideIndex, setCurrentSlideIndex]);

  const goToPrev = useCallback(() => {
    if (!currentStage) return;
    const prevIndex = currentSlideIndex === 0 
      ? currentStage.slides.length - 1 
      : currentSlideIndex - 1;
    setCurrentSlideIndex(prevIndex);
  }, [currentStage, currentSlideIndex, setCurrentSlideIndex]);

  const goToSlide = useCallback((index: number) => {
    setCurrentSlideIndex(index);
  }, [setCurrentSlideIndex]);

  // 关闭播放器
  const handleClose = () => {
    setSvgPlayerOpen(false);
    setCurrentStage(null);
    setAutoPlay(true);
  };

  // 切换自动播放
  const toggleAutoPlay = () => {
    setAutoPlay(!isAutoPlay);
  };

  // 跳转到标记点
  const handleJumpToMarker = () => {
    if (currentSlide?.markerId) {
      flyToMarker(currentSlide.markerId);
    }
  };

  if (!isSvgPlayerOpen || !currentStage) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-30 pointer-events-none">
      {/* SVG 展示区域 - 位于左下角，预留侧栏位置 */}
      <div className="absolute bottom-4 left-[400px] pointer-events-auto">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="bg-white/95 backdrop-blur-xl rounded-xl shadow-2xl overflow-hidden"
          style={{ width: '420px', maxWidth: 'calc(100vw - 420px)' }}
        >
          {/* 关闭按钮 - 右上角悬浮 */}
          <div className="absolute top-2 right-2 z-10 flex items-center gap-1">
            {/* 跳转到标记点按钮 */}
            {currentSlide?.markerId && (
              <button
                onClick={handleJumpToMarker}
                className="p-1.5 rounded-md bg-white/80 hover:bg-white transition-colors text-primary-6 shadow-sm"
                title="跳转到地图位置"
              >
                <MapPin size={14} />
              </button>
            )}
            {/* 关闭按钮 */}
            <button
              onClick={handleClose}
              className="p-1.5 rounded-md bg-white/80 hover:bg-white transition-colors text-neutral-10 shadow-sm"
            >
              <X size={14} />
            </button>
          </div>

          {/* SVG 内容区域 */}
          <div className="relative" style={{ height: '220px' }}>
            <AnimatePresence mode="wait">
              <motion.div
                key={currentSlide?.id}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="absolute inset-0 flex items-center justify-center p-4"
              >
                {isLoading ? (
                  <div className="w-10 h-10 border-3 border-primary-2 border-t-primary-6 rounded-full animate-spin" />
                ) : (
                  <div
                    className="w-full h-full flex items-center justify-center svg-container"
                    dangerouslySetInnerHTML={{ __html: svgContent }}
                    style={{ 
                      maxHeight: '100%',
                    }}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* 注解区域 */}
          <div className="px-4 py-2 bg-neutral-1 border-t border-neutral-2">
            <AnimatePresence mode="wait">
              <motion.p
                key={currentSlide?.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="text-xs text-neutral-12 leading-relaxed"
              >
                {currentSlide?.annotation}
              </motion.p>
            </AnimatePresence>
          </div>

          {/* 控制栏 */}
          <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-2">
            {/* 上一张 */}
            <button
              onClick={goToPrev}
              className="p-1.5 rounded-md hover:bg-neutral-3 transition-colors text-neutral-10"
            >
              <ChevronLeft size={16} />
            </button>

            {/* 进度指示器和播放控制 */}
            <div className="flex items-center gap-3">
              {/* 播放/暂停按钮 */}
              <button
                onClick={toggleAutoPlay}
                className={`p-1.5 rounded-md transition-colors ${
                  isAutoPlay ? 'bg-primary-6 text-white' : 'bg-neutral-3 text-neutral-10'
                }`}
              >
                {isAutoPlay ? <Pause size={14} /> : <Play size={14} />}
              </button>

              {/* 进度点 */}
              <div className="flex items-center gap-1.5">
                {currentStage.slides.map((slide, index) => (
                  <button
                    key={slide.id}
                    onClick={() => goToSlide(index)}
                    className={`w-2 h-2 rounded-full transition-all ${
                      index === currentSlideIndex
                        ? 'bg-primary-6 scale-125'
                        : 'bg-neutral-4 hover:bg-neutral-6'
                    }`}
                  />
                ))}
              </div>

              {/* 页码 */}
              <span className="text-xs text-neutral-8">
                {currentSlideIndex + 1} / {currentStage.slides.length}
              </span>
            </div>

            {/* 下一张 */}
            <button
              onClick={goToNext}
              className="p-1.5 rounded-md hover:bg-neutral-3 transition-colors text-neutral-10"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
