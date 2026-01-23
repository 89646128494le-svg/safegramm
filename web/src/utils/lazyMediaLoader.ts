// Ленивая загрузка медиафайлов с Intersection Observer

interface LazyMediaOptions {
  root?: Element | null;
  rootMargin?: string;
  threshold?: number;
}

// Загрузка изображения при появлении в viewport
export function setupLazyImage(img: HTMLImageElement, src: string, options: LazyMediaOptions = {}): () => void {
  // Если изображение уже загружено, ничего не делаем
  if (img.src && img.complete) {
    return () => {};
  }

  // Устанавливаем placeholder
  img.dataset.src = src;
  img.style.opacity = '0';
  img.style.transition = 'opacity 0.3s';

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const image = entry.target as HTMLImageElement;
          const imageSrc = image.dataset.src;
          
          if (imageSrc) {
            // Загружаем изображение
            const tempImg = new Image();
            tempImg.onload = () => {
              image.src = imageSrc;
              image.style.opacity = '1';
              delete image.dataset.src;
            };
            tempImg.onerror = () => {
              image.style.opacity = '1';
              image.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EОшибка загрузки%3C/text%3E%3C/svg%3E';
            };
            tempImg.src = imageSrc;
          }
          
          observer.unobserve(image);
        }
      });
    },
    {
      root: options.root || null,
      rootMargin: options.rootMargin || '50px',
      threshold: options.threshold || 0.1
    }
  );

  observer.observe(img);

  return () => {
    observer.disconnect();
  };
}

// Загрузка видео при появлении в viewport
export function setupLazyVideo(video: HTMLVideoElement, src: string, options: LazyMediaOptions = {}): () => void {
  // Если видео уже загружено, ничего не делаем
  if (video.src) {
    return () => {};
  }

  video.dataset.src = src;
  video.poster = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em"%3EЗагрузка...%3C/text%3E%3C/svg%3E';

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const videoElement = entry.target as HTMLVideoElement;
          const videoSrc = videoElement.dataset.src;
          
          if (videoSrc) {
            videoElement.src = videoSrc;
            videoElement.load();
            delete videoElement.dataset.src;
          }
          
          observer.unobserve(videoElement);
        }
      });
    },
    {
      root: options.root || null,
      rootMargin: options.rootMargin || '100px',
      threshold: options.threshold || 0.1
    }
  );

  observer.observe(video);

  return () => {
    observer.disconnect();
  };
}

// Автоматическая настройка ленивой загрузки для всех изображений в контейнере
export function setupLazyImagesInContainer(container: HTMLElement, options: LazyMediaOptions = {}): () => void {
  const images = container.querySelectorAll<HTMLImageElement>('img[data-lazy]');
  const videos = container.querySelectorAll<HTMLVideoElement>('video[data-lazy]');
  
  const cleanupFunctions: Array<() => void> = [];

  images.forEach((img) => {
    const src = img.dataset.lazy;
    if (src) {
      const cleanup = setupLazyImage(img, src, options);
      cleanupFunctions.push(cleanup);
    }
  });

  videos.forEach((video) => {
    const src = video.dataset.lazy;
    if (src) {
      const cleanup = setupLazyVideo(video, src, options);
      cleanupFunctions.push(cleanup);
    }
  });

  return () => {
    cleanupFunctions.forEach(cleanup => cleanup());
  };
}
