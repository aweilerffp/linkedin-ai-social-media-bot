function LoadingSpinner({ 
  size = 'md', 
  className = '',
  text = null 
}) {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-6 w-6',
    lg: 'h-8 w-8',
    xl: 'h-12 w-12',
  };

  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className="flex flex-col items-center">
        <div 
          className={`animate-spin rounded-full border-b-2 border-indigo-600 ${sizeClasses[size]}`}
        />
        {text && (
          <p className="text-sm text-gray-500 mt-2">{text}</p>
        )}
      </div>
    </div>
  );
}

export default LoadingSpinner;