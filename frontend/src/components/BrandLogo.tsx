import { BRAND_LOGO_SRC, BRAND_NAME, APP_SYSTEM_NAME } from '@/constants/brand';

type BrandLogoVariant = 'sidebar' | 'sidebar-collapsed' | 'header' | 'page' | 'hero' | 'watermark';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  showName?: boolean;
}

const variantClass: Record<BrandLogoVariant, string> = {
  sidebar: 'brand-logo-sidebar',
  'sidebar-collapsed': 'brand-logo-sidebar-collapsed',
  header: 'brand-logo-header',
  page: 'brand-logo-page',
  hero: 'brand-logo-hero',
  watermark: 'brand-logo-watermark',
};

export default function BrandLogo({
  variant = 'page',
  className = '',
  showName = false,
}: BrandLogoProps) {
  return (
    <div className={`brand-logo-wrap ${variantClass[variant]} ${className}`.trim()}>
      <img src={BRAND_LOGO_SRC} alt={BRAND_NAME} className="brand-logo-img" draggable={false} />
      {showName && variant !== 'sidebar-collapsed' && (
        <span className="brand-logo-name">{APP_SYSTEM_NAME}</span>
      )}
    </div>
  );
}
