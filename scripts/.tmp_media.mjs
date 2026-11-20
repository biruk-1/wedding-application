function unsplash(photoId, width=1400){return https://images.unsplash.com/?auto=format&fit=crop&w=&q=80;}
const VENDOR_MEDIA = {
  // Hotels / event venues — distinct luxury hotel & ballroom photos
  'venue-001': { cover: unsplash('photo-1566073771259-6a8506099945'), gallery: [unsplash('photo-1551882547-ff40c63fe5fa', 900), unsplash('photo-1542314831-068cd1dbfeeb', 900)] },
  'venue-002': { cover: unsplash('photo-1582719508461-905c673771fd'), gallery: [unsplash('photo-1578683010236-d716f9a3f461', 900), unsplash('photo-1631049307264-da0ec9d70304', 900)] },
  'venue-003': { cover: unsplash('photo-1618773928121-c32242e63f39'), gallery: [unsplash('photo-1590490360182-c33d57733427', 900), unsplash('photo-1566665797739-1674de7a421a', 900)] },
  'venue-004': { cover: unsplash('photo-1520250497591-112f2f40a3f4'), gallery: [unsplash('photo-1455587734955-081b22074882', 900), unsplash('photo-1596436889106-be35e843f974', 900)] },
  'venue-005': { cover: unsplash('photo-1564501049412-61c2a3083791'), gallery: [unsplash('photo-1611892440504-42a792e24d32', 900), unsplash('photo-1584132967334-10e028bd69f1', 900)] },
  'venue-006': { cover: unsplash('photo-1571896349842-33c89424de2d'), gallery: [unsplash('photo-1568084680786-a84f91d1153c', 900), unsplash('photo-1590381105924-c72589b9ef3f', 900)] },
  'venue-007': { cover: unsplash('photo-1445019980597-93fa8acb246c'), gallery: [unsplash('photo-1522771739844-6a9f6d5f14af', 900), unsplash('photo-1631049552057-403cdb8f0658', 900)] },
  'venue-008': { cover: unsplash('photo-1582719478250-c89cae4dc85b'), gallery: [unsplash('photo-1551632811-561732d1e306', 900), unsplash('photo-1571003123894-1f0594d2b5d9', 900)] },
  'venue-009': { cover: unsplash('photo-1496417263034-38ec4f0b665a'), gallery: [unsplash('photo-1610641818989-c2051b5e2e85', 900), unsplash('photo-1595576508898-0ad5c879a061', 900)] },
  'venue-010': { cover: unsplash('photo-1519167758481-83f550bb49b3'), gallery: [unsplash('photo-1464366400600-7168b8af9bc3', 900), unsplash('photo-1478144592103-25e218a04891', 900)] },
  'venue-011': { cover: unsplash('photo-1519225421980-715cb0215aed'), gallery: [unsplash('photo-1465495976277-4387d4b0b4c6', 900), unsplash('photo-1507504031213-bffde0529fb4', 900)] },
  'venue-012': { cover: unsplash('photo-1505236858219-8359eb29e329'), gallery: [unsplash('photo-1523438885200-e635ba2c371e', 900), unsplash('photo-1511285560929-80b456fea0bc', 900)] },
  'venue-013': { cover: unsplash('photo-1540541338287-41700207dee6'), gallery: [unsplash('photo-1606046607433-bac643deb7d0', 900), unsplash('photo-1596394516093-501ba68a0ba6', 900)] },
  'venue-014': { cover: unsplash('photo-1602002418082-a4443e061877'), gallery: [unsplash('photo-1629140727571-9b5c6f6267b1', 900), unsplash('photo-1551882547-ff40c63fe5fa', 900)] },
  'venue-015': { cover: unsplash('photo-1522708323590-d24dbb6b0267'), gallery: [unsplash('photo-1560448204-e02f11c3d0e2', 900), unsplash('photo-1631049552057-403cdb8f0658', 900)] },
  'venue-016': { cover: unsplash('photo-1566665797739-1674de7a421a'), gallery: [unsplash('photo-1584132967334-10e028bd69f1', 900), unsplash('photo-1568084680786-a84f91d1153c', 900)] },
  'venue-017': { cover: unsplash('photo-1590381105924-c72589b9ef3f'), gallery: [unsplash('photo-1522771739844-6a9f6d5f14af', 900), unsplash('photo-1618773928121-c32242e63f39', 900)] },
  'venue-018': { cover: unsplash('photo-1551632811-561732d1e306'), gallery: [unsplash('photo-1582719478250-c89cae4dc85b', 900), unsplash('photo-1578683010236-d716f9a3f461', 900)] },
  'venue-019': { cover: unsplash('photo-1571003123894-1f0594d2b5d9'), gallery: [unsplash('photo-1590490360182-c33d57733427', 900), unsplash('photo-1631049307264-da0ec9d70304', 900)] },
  'venue-020': { cover: unsplash('photo-1455587734955-081b22074882'), gallery: [unsplash('photo-1542314831-068cd1dbfeeb', 900), unsplash('photo-1596436889106-be35e843f974', 900)] },

  // Service vendors — images match the service type, covers never reused
  'vendor-001': { cover: unsplash('photo-1511795409834-ef04bbd61622'), gallery: [unsplash('photo-1464366400600-7168b8af9bc3', 900), unsplash('photo-1478144592103-25e218a04891', 900)] }, // planner
  'vendor-002': { cover: unsplash('photo-1487412947147-5cebf100ffc2'), gallery: [unsplash('photo-1522335789203-aabd1fc54bc9', 900), unsplash('photo-1512496015851-a90fb38ba796', 900)] }, // makeup
  'vendor-003': { cover: unsplash('photo-1560066984-138dadb4c035'), gallery: [unsplash('photo-1595476108010-b4d1e102bbad', 900), unsplash('photo-1526045478516-99145907023c', 900)] }, // makeup
  'vendor-004': { cover: unsplash('photo-1519741497674-611481863552'), gallery: [unsplash('photo-1606800052052-a08af7148866', 900), unsplash('photo-1529636798458-92182e662485', 900)] }, // photo
  'vendor-005': { cover: unsplash('photo-1492691527719-9d1e07e534b4'), gallery: [unsplash('photo-1511285560929-80b456fea0bc', 900), unsplash('photo-1523438885200-e635ba2c371e', 900)] }, // photo/video
  'vendor-006': { cover: unsplash('photo-1555244162-803834f70033'), gallery: [unsplash('photo-1414235077428-338989a2e8c0', 900), unsplash('photo-1551218808-94e220e084d2', 900)] }, // catering
  'vendor-007': { cover: unsplash('photo-1504674900247-0877df9cc836'), gallery: [unsplash('photo-1540189549336-e6e99c3679fe', 900), unsplash('photo-1567620905732-2d1ec7ab7445', 900)] }, // catering
  'vendor-008': { cover: unsplash('photo-1478146896981-b80fe463b330'), gallery: [unsplash('photo-1465495976277-4387d4b0b4c6', 900), unsplash('photo-1519167758481-83f550bb49b3', 900)] }, // traditional decor
  'vendor-009': { cover: unsplash('photo-1520854221256-17451cc331bf'), gallery: [unsplash('photo-1487530811176-3780da1762ab', 900), unsplash('photo-1457089328109-e5d9bd499191', 900)] }, // decor styling
  'vendor-010': { cover: unsplash('photo-1460978812857-470ed1c77af0'), gallery: [unsplash('photo-1515934751635-c81c6bc9a2d8', 900), unsplash('photo-1507504031213-bffde0529fb4', 900)] }, // traditional decor
  'vendor-011': { cover: unsplash('photo-1530103862676-de8c9debad1d'), gallery: [unsplash('photo-1464366400600-7168b8af9bc3', 900), unsplash('photo-1511795409834-ef04bbd61622', 900)] }, // events/decor
  'vendor-012': { cover: unsplash('photo-1594552072238-5f59b77b44e1'), gallery: [unsplash('photo-1515372039744-b8f02a3ae446', 900), unsplash('photo-1496747611176-843222e1e57c', 900)] }, // attire
  'vendor-013': { cover: unsplash('photo-1495474472287-4d71bcdd2085'), gallery: [unsplash('photo-1447933601403-0c6688de566e', 900), unsplash('photo-1509042239860-f550ce710b93', 900)] }, // coffee
  'vendor-014': { cover: unsplash('photo-1490750967868-88aa4486c946'), gallery: [unsplash('photo-1462275646964-a0e3386b89fa', 900), unsplash('photo-1487530811176-3780da1762ab', 900)] }, // florist
  'vendor-015': { cover: unsplash('photo-1493225457124-a3eb161ffa5f'), gallery: [unsplash('photo-1511671782779-c97d3d27a1d4', 900), unsplash('photo-1459749411175-04bf52967743', 900)] }, // live band
  'vendor-016': { cover: unsplash('photo-1607345366928-199ea26cfe3e'), gallery: [unsplash('photo-1510070007569-eeffc802c1c1', 900), unsplash('photo-1469371670807-013ccf25f16a', 900)] }, // invitations
  'vendor-017': { cover: unsplash('photo-1464349095431-e9a21285b5f3'), gallery: [unsplash('photo-1535254973040-607b474cb50d', 900), unsplash('photo-1563729784474-d77dbb933a9e', 900)] }, // cakes
  'vendor-018': { cover: unsplash('photo-1511919884226-fd3cad54643f'), gallery: [unsplash('photo-1503376780353-7e6692767b70', 900), unsplash('photo-1492144534655-ae79c964c9d7', 900)] }, // transport
  'vendor-019': { cover: unsplash('photo-1470225620780-dba8ba36b745'), gallery: [unsplash('photo-1520854221256-17451cc331bf', 900), unsplash('photo-1478146896981-b80fe463b330', 900)] }, // traditional rental
  'vendor-020': { cover: unsplash('photo-1429962714451-bb934ecdc4ec'), gallery: [unsplash('photo-1501386761570-0cd27d8b00d4', 900), unsplash('photo-1571266028247-e67670b0337f', 900)] }, // sound/lighting
};


export default VENDOR_MEDIA;
