-- Local-only demo chat seed for FatortakDemo.
-- Never run this against production.
SET NOCOUNT ON;

DECLARE @TenantId uniqueidentifier = '0328bd22-934a-4e94-95b0-b25d4b91cdee';
DECLARE @UserId uniqueidentifier = '99a54dac-07c8-427e-1c82-08df34154bc3';

DECLARE @S1 uniqueidentifier = '11111111-1111-1111-1111-111111111111';
DECLARE @S2 uniqueidentifier = '22222222-2222-2222-2222-222222222222';
DECLARE @S3 uniqueidentifier = '33333333-3333-3333-3333-333333333333';

DELETE FROM ChatMessages WHERE SessionId IN (@S1, @S2, @S3);
DELETE FROM ChatSessions WHERE Id IN (@S1, @S2, @S3);

INSERT INTO ChatSessions (Id, TenantId, UserId, Title, CreatedAt, UpdatedAt, IsDeleted)
VALUES
  (@S1, @TenantId, @UserId, N'October performance review', '2026-10-27T10:00:00', '2026-10-27T10:10:00', 0),
  (@S2, @TenantId, @UserId, N'Cash and payables check', '2026-10-26T16:00:00', '2026-10-26T16:30:00', 0),
  (@S3, @TenantId, @UserId, N'Top clients by revenue', '2026-10-25T09:00:00', '2026-10-25T09:15:00', 0);

INSERT INTO ChatMessages (Id, SessionId, Content, Role, CreatedAt, Metadata, VisualizationData)
VALUES
  (NEWID(), @S1, N'How did October compare with September?', N'user', '2026-10-27T10:00:00', N'{}', NULL),
  (NEWID(), @S1, N'October revenue was **EGP 667,185**, down **8.7%** from September (EGP 730,740).

Expenses fell **85.3%** to **EGP 31,400**, so net profit rose **22.9%** to **EGP 635,785**. Net margin was **95.3%**.', N'assistant', '2026-10-27T10:00:20', N'{}',
   N'{"Type":"kpi","Title":"October 2026","Data":[{"label":"Revenue","value":"EGP 667,185","change":"-8.7%","trend":"down"},{"label":"Expenses","value":"EGP 31,400","change":"-85.3%","trend":"down"},{"label":"Net profit","value":"EGP 635,785","change":"+22.9%","trend":"up"}]}'),

  (NEWID(), @S1, N'Who owes us the most right now?', N'user', '2026-10-27T10:03:00', N'{}', NULL),
  (NEWID(), @S1, N'Open receivables total **EGP 1,692,745** across five clients.

Delta Health Systems leads with **EGP 524,400**, followed by Nile Gate Developments at **EGP 521,040** and Sahara Retail Group at **EGP 502,525**. Beirut Design Collective owes **EGP 104,880** and Levant Hospitality Partners **EGP 39,900**.', N'assistant', '2026-10-27T10:03:20', N'{}',
   N'{"Type":"chart","ChartType":"bar","Title":"Open receivables by client","description":"Outstanding balances, excluding draft invoices","Data":[{"name":"Delta Health","value":524400},{"name":"Nile Gate","value":521040},{"name":"Sahara Retail","value":502525},{"name":"Beirut Design","value":104880},{"name":"Levant Hospitality","value":39900}]}'),

  (NEWID(), @S1, N'Which project is most profitable?', N'user', '2026-10-27T10:06:00', N'{}', NULL),
  (NEWID(), @S1, N'Zed Retail - Commerce Platform is the strongest project at **EGP 595,100** net profit on **EGP 615,600** invoiced.

Delta Care follows at **EGP 516,900**, then Aurora Residences at **EGP 430,000**. Marsa Hospitality has collected **100%** of its **EGP 444,600** invoiced.', N'assistant', '2026-10-27T10:06:20', N'{}',
   N'{"Type":"chart","ChartType":"bar","Title":"Net profit by project","description":"Invoiced revenue less project expenses","Data":[{"name":"Zed Retail","value":595100},{"name":"Delta Care","value":516900},{"name":"Aurora","value":430000},{"name":"Marsa","value":421000}]}'),

  (NEWID(), @S2, N'What is our cash position?', N'user', '2026-10-26T16:00:00', N'{}', NULL),
  (NEWID(), @S2, N'Bank balance is **EGP 1,202,710** and cash on hand is **EGP 0**. Open receivables are **EGP 1,692,745**; open payables are **EGP 63,270**, leaving a receivables-over-payables buffer of **EGP 1,629,475**.', N'assistant', '2026-10-26T16:00:20', N'{}',
   N'{"Type":"kpi","Data":[{"label":"Bank balance","value":"EGP 1,202,710","trend":"up"},{"label":"Receivables","value":"EGP 1,692,745"},{"label":"Payables","value":"EGP 63,270"}]}'),

  (NEWID(), @S3, N'Who are our top clients this year?', N'user', '2026-10-25T09:00:00', N'{}', NULL),
  (NEWID(), @S3, N'Sahara Retail Group leads YTD revenue at **EGP 702,525**, followed by Nile Gate Developments at **EGP 657,840** and Riyadh Creative District at **EGP 644,100**. Delta Health Systems contributed **EGP 524,400** and Levant Hospitality Partners **EGP 484,500**.', N'assistant', '2026-10-25T09:00:20', N'{}',
   N'{"Type":"chart","ChartType":"bar","Title":"Top clients by revenue","description":"Year-to-date sell invoices, excluding draft invoices","Data":[{"name":"Sahara Retail","value":702525},{"name":"Nile Gate","value":657840},{"name":"Riyadh Creative","value":644100},{"name":"Delta Health","value":524400},{"name":"Levant Hospitality","value":484500}]}');
