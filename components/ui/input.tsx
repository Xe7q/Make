import * as React from 'react';
export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({className='', ...props}, ref) => (
    <input ref={ref} className={`border border-gray-300 rounded-xl px-3 py-2 w-full focus:outline-none focus:ring-2 focus:ring-gray-300 ${className}`} {...props} />
  )
);
Input.displayName = 'Input';
export default Input;
