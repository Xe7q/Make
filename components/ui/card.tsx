import * as React from 'react';
export const Card: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({className='', ...props}) => (
  <div className={`bg-white border border-gray-200 rounded-2xl ${className}`} {...props} />
);
export const CardContent: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({className='', ...props}) => (
  <div className={`p-4 ${className}`} {...props} />
);
export default Card;
