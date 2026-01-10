'use strict';
import $ from 'jquery';

$('.availability-toggle-button').each((i, e) => {
  const button = $(e);
  button.on('click', () => {
    const scheduleId = button.data('schedule-id');
    const userId = button.data('user-id');
    const candidateId = button.data('candidate-id');
    const availability = parseInt(button.data('availability'));
    const nextAvailability = (availability + 1) % 3;
    fetch(
      `/schedules/${scheduleId}/users/${userId}/candidates/${candidateId}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ availability: nextAvailability }),
      },
    )
      .then((response) => response.json())
      .then((data) => {
        button.data('availability', data.availability);
        const availabilityLabels = ['❌', '？', '🙆‍♂️'];
        button.text(availabilityLabels[data.availability]);
      });
  });
});
