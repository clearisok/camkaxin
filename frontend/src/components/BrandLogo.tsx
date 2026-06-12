import { BRAND_LOGO_SRC, BRAND_NAME, APP_SYSTEM_NAME } from '@/constants/brand';

type BrandLogoVariant = 'sidebar' | 'sidebar-collapsed' | 'header' | 'page' | 'hero' | 'watermark';

interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  showName?: boolean;
  /** 侧栏折叠动画（与 Ant Design Sider 同步，勿切换 variant） */
  collapsed?: boolean;
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
  collapsed = false,
}: BrandLogoProps) {
  const isSidebar = variant === 'sidebar' || variant === 'sidebar-collapsed';
  const wrapClass = [
    'brand-logo-wrap',
    isSidebar ? 'brand-logo-sidebar' : variantClass[variant],
    isSidebar && collapsed ? 'is-collapsed' : '',
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapClass}>
      <img src={BRAND_LOGO_SRC} alt={BRAND_NAME} className="brand-logo-img" draggable={false} />
      {showName && isSidebar && (
        <span className="brand-logo-name-slot" aria-hidden={collapsed}>
          <span className="brand-logo-name">{APP_SYSTEM_NAME}</span>
        </span>
      )}
      {showName && !isSidebar && (
        <span className="brand-logo-name">{APP_SYSTEM_NAME}</span>
      )}
    </div>
  );
}
