import { ArrowUpIcon, ArrowDownIcon } from '@heroicons/react/24/solid';

function StatCard({ 
  title, 
  value, 
  previousValue = null, 
  icon: Icon = null, 
  loading = false,
  format = 'number',
  className = '',
}) {
  const formatValue = (val) => {
    if (loading || val === null || val === undefined) return '---';
    
    switch (format) {
      case 'currency':
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(val);
      case 'percentage':
        return `${val.toFixed(1)}%`;
      case 'compact':
        return new Intl.NumberFormat('en-US', {
          notation: 'compact',
          maximumFractionDigits: 1,
        }).format(val);
      default:
        return new Intl.NumberFormat('en-US').format(val);
    }
  };

  const calculateChange = () => {
    if (previousValue === null || previousValue === 0 || loading) return null;
    return ((value - previousValue) / previousValue) * 100;
  };

  const change = calculateChange();
  const isPositive = change > 0;
  const isNegative = change < 0;

  return (
    <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-200 ${className}`}>
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-2xl font-bold text-gray-900">
            {formatValue(value)}
          </p>
          
          {change !== null && (
            <div className="flex items-center mt-2">
              {isPositive ? (
                <ArrowUpIcon className="w-4 h-4 text-green-500 mr-1" />
              ) : isNegative ? (
                <ArrowDownIcon className="w-4 h-4 text-red-500 mr-1" />
              ) : null}
              <span 
                className={`text-sm font-medium ${
                  isPositive 
                    ? 'text-green-600' 
                    : isNegative 
                    ? 'text-red-600' 
                    : 'text-gray-500'
                }`}
              >
                {Math.abs(change).toFixed(1)}%
              </span>
              <span className="text-sm text-gray-500 ml-1">vs last period</span>
            </div>
          )}
        </div>
        
        {Icon && (
          <div className="p-3 bg-indigo-100 rounded-lg">
            <Icon className="w-6 h-6 text-indigo-600" />
          </div>
        )}
      </div>

      {loading && (
        <div className="absolute inset-0 bg-white bg-opacity-50 flex items-center justify-center rounded-xl">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-indigo-600"></div>
        </div>
      )}
    </div>
  );
}

export default StatCard;