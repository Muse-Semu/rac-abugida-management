import React, { useEffect } from 'react';
import { useAppContext } from '../../context/AppContext';
import { DashboardMetric } from '../../types';
import { supabase } from '../../supabaseClient';

export const Dashboard: React.FC = () => {
  const { dashboardState, dispatch } = useAppContext();

  
  useEffect(() => {
    const fetchMetrics = async () => {
      try {
        dispatch({ type: 'SET_DASHBOARD_STATE', payload: { isLoading: true } });
        
        const { data: metrics, error } = await supabase
          .from('dashboard_metrics')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) throw error;

        dispatch({
          type: 'SET_DASHBOARD_STATE',
          payload: {
            metrics: metrics as DashboardMetric[],
            isLoading: false,
            error: null,
          },
        });
      } catch (error) {
        dispatch({
          type: 'SET_DASHBOARD_STATE',
          payload: {
            error: error instanceof Error ? error.message : 'An error occurred',
            isLoading: false,
          },
        });
      }
    };

    fetchMetrics();

    // Set up real-time subscription
    const subscription = supabase
      .channel('dashboard_metrics_changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'dashboard_metrics',
        },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newMetric = payload.new as DashboardMetric;
            dispatch({
              type: 'SET_DASHBOARD_STATE',
              payload: {
                metrics: [newMetric, ...dashboardState.metrics],
              },
            });
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [dispatch]);

  if (dashboardState.isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  if (dashboardState.error) {
    return (
      <div className="text-red-500 text-center p-4">
        Error: {dashboardState.error}
      </div>
    );
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {dashboardState.metrics.map((metric) => (
          <div
            key={metric.id}
            className="bg-white p-6 rounded-lg shadow-md"
          >
            <h3 className="text-lg font-semibold mb-2">{metric.metric_name}</h3>
            <div className="text-gray-600">
              {typeof metric.metric_value === 'object'
                ? JSON.stringify(metric.metric_value)
                : metric.metric_value}
            </div>
            <div className="text-sm text-gray-500 mt-2">
              {metric.related_entity_type}
              {metric.related_entity_id && ` - ID: ${metric.related_entity_id}`}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 