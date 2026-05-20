-- Recover foreign-currency payment FX only when the stored THB amount still proves it.
-- If amount_thb was already overwritten to amount * 1, the original rate cannot be inferred.

update po_payments
set exchange_rate = round((amount_thb / nullif(amount, 0))::numeric, 6)
where upper(coalesce(currency, 'THB')) <> 'THB'
  and coalesce(amount, 0) > 0
  and coalesce(amount_thb, 0) > 0
  and coalesce(exchange_rate, 0) <= 1
  and (amount_thb / nullif(amount, 0)) > 1;
