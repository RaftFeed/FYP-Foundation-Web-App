export function getDummyPaymentsSummaryByDay(days: number) {
  const today = new Date();
  const rows: Array<{ day: string; total: number }> = [];

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    const label = d.toISOString().slice(0, 10);
    // Generate a pseudo-random but deterministic value based on date
    const value = Math.round( (Math.sin(d.getDate()) + 1) * 50000 + (d.getMonth()+1) * 10000 );
    rows.push({ day: label, total: value });
  }

  return rows;
}

export function getDummyDailyPaymentsReport(date: string) {
  // return several dummy payments for a given day
  const items: Array<any> = [];
  const count = 6;
  for (let i = 0; i < count; i++) {
    const id = `${date.replace(/-/g, '')}-${i}`;
    const amount = Math.round((i + 1) * 25000 + (i % 3) * 10000);
    items.push({
      id: id,
      booking_id: `bk-${id}`,
      amount: amount,
      payment_method: i % 2 === 0 ? 'card' : 'bank_transfer',
      status: 'paid',
      paid_at: `${date}T0${8 + i}:00:00Z`,
      created_at: `${date}T0${8 + i}:00:00Z`,
      updated_at: `${date}T0${8 + i}:00:00Z`,
    });
  }
  return items;
}
