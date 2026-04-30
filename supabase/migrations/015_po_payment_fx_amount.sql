alter table po_payments
  add column if not exists exchange_rate numeric(14, 6) not null default 1,
  add column if not exists amount_thb numeric(14, 4) not null default 0;

update po_payments
set
  exchange_rate = case
    when exchange_rate is null or exchange_rate <= 0 then 1
    else exchange_rate
  end,
  amount_thb = case
    when amount_thb is null or amount_thb = 0 then amount * coalesce(nullif(exchange_rate, 0), 1)
    else amount_thb
  end;
