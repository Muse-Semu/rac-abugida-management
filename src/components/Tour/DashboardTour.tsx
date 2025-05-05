import React, { useState, useEffect } from 'react';
import Joyride, { CallBackProps, STATUS } from 'react-joyride';

export const DashboardTour: React.FC = () => {
  const [run, setRun] = useState(false);

  useEffect(() => {
    // Check if it's the user's first visit
    const hasSeenTour = localStorage.getItem('hasSeenDashboardTour');
    if (!hasSeenTour) {
      setRun(true);
    }
  }, []);

  const steps = [
    {
      target: '.dashboard-overview',
      content: 'Welcome to your dashboard! Here you can see an overview of your events and projects.',
      placement: 'bottom',
    },
    {
      target: '.events-section',
      content: 'View and manage all your events in one place.',
      placement: 'left',
    },
    {
      target: '.projects-section',
      content: 'Track your projects and their progress here.',
      placement: 'left',
    },
    {
      target: '.users-section',
      content: 'Manage team members and their roles.',
      placement: 'left',
    },
    {
      target: '.analytics-section',
      content: 'View detailed analytics and metrics.',
      placement: 'left',
    },
  ];

  const handleJoyrideCallback = (data: CallBackProps) => {
    const { status } = data;
    if ([STATUS.FINISHED, STATUS.SKIPPED].includes(status)) {
      // Save that the user has seen the tour
      localStorage.setItem('hasSeenDashboardTour', 'true');
      setRun(false);
    }
  };

  return (
    <Joyride
      steps={steps}
      run={run}
      continuous
      showProgress
      showSkipButton
      callback={handleJoyrideCallback}
      styles={{
        options: {
          primaryColor: '#4F46E5',
          zIndex: 1000,
        },
      }}
    />
  );
}; 