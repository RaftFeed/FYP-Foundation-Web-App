-- Seed bookings and payments for development/demo
-- Inserts booking+payment rows for last 10 days if there is at least one student and one session in the DB

DO $$
DECLARE
  v_student uuid;
  v_session uuid;
  v_booking uuid;
  d date;
  i int;
BEGIN
  SELECT id INTO v_student FROM public.profiles WHERE role = 'student' LIMIT 1;
  SELECT id INTO v_session FROM public.course_sessions LIMIT 1;

  IF v_student IS NULL OR v_session IS NULL THEN
    RAISE NOTICE 'No student or session found - skipping payment seeding.';
    RETURN;
  END IF;

  FOR i IN 0..9 LOOP
    d := current_date - i;

    -- find or create a booking for that student/session
    SELECT id INTO v_booking FROM public.bookings WHERE session_id = v_session AND student_id = v_student LIMIT 1;

    IF v_booking IS NULL THEN
      v_booking := gen_random_uuid();
      INSERT INTO public.bookings (id, session_id, student_id, status, total_price, created_at, updated_at)
      VALUES (v_booking, v_session, v_student, 'completed', 100000, (d::timestamptz + time '10:00'), now())
      ON CONFLICT (session_id, student_id) DO NOTHING;

      -- if conflict happened due to existing (rare), select the id again
      IF NOT FOUND THEN
        SELECT id INTO v_booking FROM public.bookings WHERE session_id = v_session AND student_id = v_student LIMIT 1;
      END IF;
    END IF;

    -- Insert payment for that booking (skip if already exists for same created_at)
    IF NOT EXISTS (
      SELECT 1 FROM public.payments p WHERE p.booking_id = v_booking AND date(p.created_at) = d
    ) THEN
      INSERT INTO public.payments (id, booking_id, amount, payment_method, status, paid_at, created_at, updated_at)
      VALUES (gen_random_uuid(), v_booking, 100000 + (i * 5000), 'card', 'paid', (d::timestamptz + time '10:05'), (d::timestamptz + time '10:05'), now());
    END IF;
  END LOOP;

  RAISE NOTICE 'Seed payments completed for student % and session %', v_student, v_session;
END
$$;
