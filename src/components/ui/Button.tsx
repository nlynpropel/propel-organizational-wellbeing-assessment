import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
type Size = 'sm' | 'md' | 'lg';

const variantClasses: Record<Variant, string> = {
  primary: 'bg-navy hover:bg-navy-mid text-white shadow-sm',
  secondary: 'bg-green hover:bg-green-dark text-navy-deep font-semibold',
  ghost: 'bg-transparent hover:bg-navy/5 text-navy',
  danger: 'bg-red hover:bg-red/90 text-white',
  outline: 'bg-white border border-navy/15 text-navy hover:bg-navy/5 hover:border-navy/25',
};

const sizeClasses: Record<Size, string> = {
  sm: 'text-sm px-3 py-1.5 rounded-sm gap-1.5',
  md: 'text-sm px-4 py-2 rounded-sm gap-2',
  lg: 'text-base px-5 py-2.5 rounded-md gap-2',
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
};

type ButtonAsButton = CommonProps &
  Omit<ButtonHTMLAttributes<HTMLButtonElement>, keyof CommonProps> & {
    to?: undefined;
  };

type ButtonAsLink = CommonProps & {
  to: string;
  className?: string;
};

type ButtonProps = ButtonAsButton | ButtonAsLink;

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', className = '', children, ...rest }, ref) => {
    const cls = `inline-flex items-center justify-center font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-green/40 focus-visible:ring-offset-1 disabled:opacity-60 disabled:cursor-not-allowed ${variantClasses[variant]} ${sizeClasses[size]} ${className}`;

    if ('to' in rest && rest.to) {
      const { to, ...linkRest } = rest;
      void linkRest;
      return (
        <Link to={to} className={cls}>
          {children}
        </Link>
      );
    }

    return (
      <button ref={ref} className={cls} {...(rest as ButtonHTMLAttributes<HTMLButtonElement>)}>
        {children}
      </button>
    );
  }
);

Button.displayName = 'Button';
export default Button;
