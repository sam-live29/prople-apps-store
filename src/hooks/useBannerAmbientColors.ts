import { useState, useEffect } from 'react';
import { extractBannerAmbient, BannerAmbientColors, DEFAULT_AMBIENT } from '../utils/bannerAmbientService';

export function useBannerAmbientColors(imageUrl?: string | null): BannerAmbientColors {
  const [ambientColors, setAmbientColors] = useState<BannerAmbientColors>(DEFAULT_AMBIENT);

  useEffect(() => {
    if (!imageUrl || !imageUrl.trim()) {
      setAmbientColors(DEFAULT_AMBIENT);
      return;
    }

    let isMounted = true;
    extractBannerAmbient(imageUrl).then((colors) => {
      if (isMounted) {
        setAmbientColors(colors);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [imageUrl]);

  return ambientColors;
}
