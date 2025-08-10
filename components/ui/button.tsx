import * as React from 'react';
type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'default'|'outline', size?: 'sm'|'md'|'lg', className?: string };
export const Button: React.FC<Props> = ({variant='default', size='md', className='', ...props}) => {
  const base = 'inline-flex items-center justify-center font-medium transition focus:outline-none focus:ring-2 focus:ring-offset-2 rounded';
  const sizes = { sm: 'px-3 py-1.5 text-sm', md: 'px-4 py-2', lg: 'px-5 py-2.5 text-base' };
  const variants = {
    default: 'bg-gray-900 text-white hover:bg-gray-800 focus:ring-gray-300',
    outline: 'border border-gray-300 text-gray-900 hover:bg-gray-50 focus:ring-gray-300'
  };
  return <button className={`${base} ${sizes[size]} ${variants[variant]} ${className}`} {...props} />;
};
export default Button;
