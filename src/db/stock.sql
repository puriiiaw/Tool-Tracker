SELECT t.id, t.name, t.model, t.scan_code, t.serial_number, t.manufacturer, t.item_type,
         t.total_qty, t.status, t.import_flag, t.notes,
         COALESCE(l.out_qty, 0) AS out_qty,
         COALESCE(l.damaged_qty, 0) AS damaged_qty,
         COALESCE(l.lost_qty, 0) AS lost_qty,
         t.total_qty - COALESCE(l.out_qty, 0) - COALESCE(l.damaged_qty, 0) - COALESCE(l.lost_qty, 0) AS on_hand,
         (SELECT w.name FROM checkout_line cl2
            JOIN checkout c2 ON c2.id = cl2.checkout_id
            JOIN worker w ON w.id = c2.worker_id
           WHERE cl2.tool_id = t.id AND cl2.removed = 0 AND t.item_type = 'unique'
             AND cl2.qty_out > (SELECT COALESCE(SUM(qty), 0) FROM return_event WHERE checkout_line_id = cl2.id AND voided = 0)
           LIMIT 1) AS out_to
  FROM tool t
  LEFT JOIN (
    SELECT cl.tool_id,
           SUM(cl.qty_out - COALESCE(r.returned, 0) - COALESCE(r.damaged, 0) - COALESCE(r.lost, 0)) AS out_qty,
           SUM(COALESCE(r.damaged, 0)) AS damaged_qty,
           SUM(COALESCE(r.lost, 0)) AS lost_qty
    FROM checkout_line cl
    LEFT JOIN (
      SELECT checkout_line_id,
             SUM(CASE WHEN outcome = 'returned' THEN qty ELSE 0 END) AS returned,
             SUM(CASE WHEN outcome = 'damaged' THEN qty ELSE 0 END) AS damaged,
             SUM(CASE WHEN outcome = 'lost' THEN qty ELSE 0 END) AS lost
      FROM return_event WHERE voided = 0 GROUP BY checkout_line_id
    ) r ON r.checkout_line_id = cl.id
    WHERE cl.removed = 0
    GROUP BY cl.tool_id
  ) l ON l.tool_id = t.id
