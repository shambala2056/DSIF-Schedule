jQuery(document).ready(function() {
        $(function () {
            $('#defaultCountdown').countdown({
                until: new Date(2026, 4-1, 26, 9), // year, month, date, hour
                labels: ['Жил', 'Сар', 'Долоо хоног', 'Өдөр', 'Цаг', 'Минут', 'Секунд'],
                labels1: ['Жил', 'Сар', 'Долоо хоног', 'Өдөр', 'Цаг', 'Минут', 'Секунд']
            });
        });
});

