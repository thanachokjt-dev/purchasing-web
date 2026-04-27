// Generated from Po-Portals.xlsx.
// Contains AppSheet supplier terms and active incoming PO quantities for dashboard calculations.
export type ExcelSupplierDetail = {
  supplierCode: string;
  supplierName: string;
  paymentTerms: string;
  currency: string;
  incoterm: string;
  shipMode: string;
  contactName: string;
  contactEmail: string;
  moq: string;
  safetyDays: number;
  leadTimeDays: number;
  productScope: string;
};

export type ExcelIncomingPurchaseOrder = {
  sku: string;
  activeIncomingQty: number;
  pendingApprovalQty: number;
  activeStatuses: string[];
  pendingStatuses: string[];
};

export const excelSupplierDetails = [
  {
    "supplierCode": "DUDE001",
    "supplierName": "Dude Sport Co., Ltd.",
    "paymentTerms": "deposit50%/afterrecived25%/aftersale25%(1month)",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "081-165-5366 Khun Ty",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 35.0,
    "productScope": "Jersey"
  },
  {
    "supplierCode": "PMA001",
    "supplierName": "Paphavee Group Co.,Ltd.",
    "paymentTerms": "deposit50%/beforeshipments50%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "095-256-3414 (Office) 092-553-5656 (Khun Hannah - Owner)",
    "contactEmail": "-",
    "moq": "100/300",
    "safetyDays": 30.0,
    "leadTimeDays": 40.0,
    "productScope": "Dry-fit T-shirts, Singlets"
  },
  {
    "supplierCode": "ENGAGE001",
    "supplierName": "Engage Global",
    "paymentTerms": "deposit50%/beforeshipments25%/afterrecived25%(1month)",
    "currency": "AUD",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "Whatsapp Group : Engage x Bangtao",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 130.0,
    "productScope": "Sportwear, MMA Gloves, Boxing Gloves,Backpack,Shirt"
  },
  {
    "supplierCode": "THAITSHIRT",
    "supplierName": "Thai Tshirt Factory Co., LTD.",
    "paymentTerms": "deposit50%/beforeshipments50%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "Whatsapp Group : Bangtao Orders, Bangtao Billing",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 90.0,
    "productScope": "Microfiber T-shirt, Cotton T-shirt, Cotton-Spandex T-shirt, Muay Thai Shorts, Shinpad, Muay Thai Gloves, Handwrap"
  },
  {
    "supplierCode": "ILOVEPK",
    "supplierName": "I love Phuket",
    "paymentTerms": "deposit50%/beforeshipments50%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "093-671-2105",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 40.0,
    "productScope": "Wo Wattana T-shirt, OG Cotton Kids T-shirt"
  },
  {
    "supplierCode": "TITLEPMC",
    "supplierName": "Title Pharmacy Co.,LTD.",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "076-522-277, 064-246-9465",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 15.0,
    "leadTimeDays": 15.0,
    "productScope": "Boxing Liniment Oil (Nam Man Muay), Muay Analgesic Cream"
  },
  {
    "supplierCode": "TDS001",
    "supplierName": "Thadakittisap",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "062-220-5205",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 15.0,
    "leadTimeDays": 15.0,
    "productScope": "Sport Tape"
  },
  {
    "supplierCode": "MAPLE001",
    "supplierName": "Maplelus Co., LTD.",
    "paymentTerms": "deposit50%/beforeshipments50%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "098-953-5694",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 60.0,
    "productScope": "Towel"
  },
  {
    "supplierCode": "ADAPT001",
    "supplierName": "Adapt",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "Whatsapp + 44 7544 699899 Mr.Adam Pearce",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 60.0,
    "productScope": "Gi"
  },
  {
    "supplierCode": "BKKFG",
    "supplierName": "BKKFightGear",
    "paymentTerms": "deposit50%/afterrecived50%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "092-254-0866",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "Sisu Mouth Guard"
  },
  {
    "supplierCode": "FTBD",
    "supplierName": "Fruiting Body Co.Ltd.",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "Whatsapp + 66 95 105 8762 (Mr.Brendan)",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "Mushroom Supplement"
  },
  {
    "supplierCode": "PHAYON",
    "supplierName": "Phayon & Logo Co.,Ltd.",
    "paymentTerms": "deposit50%/beforeshipments50%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "02-496-4681",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 60.0,
    "leadTimeDays": 60.0,
    "productScope": "Keychain"
  },
  {
    "supplierCode": "GUANGZHOU",
    "supplierName": "Guang Zhou Aoking Leather Co., Ltd.",
    "paymentTerms": "deposit30%/beforeshipments70%",
    "currency": "USD",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "Email: katie@aoking.com,Tel: +86-020-8699-9525",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 90.0,
    "productScope": "Crossbody Bag"
  },
  {
    "supplierCode": "CSD001",
    "supplierName": "CSD FASHION(Weyes Clothing LTD)",
    "paymentTerms": "deposit30%/beforeshipments70%",
    "currency": "USD",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "rainbow.chen@weyes.group , MP:+86 13556688975(Wechat/Whatsapp)",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 60.0,
    "productScope": "Muay Thai Short,MMA Short ,Rash Guard,Shirt"
  },
  {
    "supplierCode": "CSD002",
    "supplierName": "CSD FASHION(Weyes Clothing LTD)",
    "paymentTerms": "deposit30%/beforeshipments70%",
    "currency": "USD",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "francis.gerard@pjcltd.com",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 60.0,
    "productScope": "Hand Wrap,Mouth Guard"
  },
  {
    "supplierCode": "CSD003",
    "supplierName": "CSD FASHION(Weyes Clothing LTD)",
    "paymentTerms": "deposit30%/beforeshipments70%",
    "currency": "USD",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "fancy@weyes.group, Tel/Wechat (China): +86 186 0760 2726",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 60.0,
    "productScope": "Gloves , Shin Guards"
  },
  {
    "supplierCode": "FTWHEY",
    "supplierName": "FITWHEY Co.,Ltd.",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "WhatsApp 061-395-8361 K.Cake",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "Whey Protein"
  },
  {
    "supplierCode": "GRAN",
    "supplierName": "GRAN HOLDING SPORT CO.,LTD",
    "paymentTerms": "deposit30%/beforeshipments70%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "WhatsApp 086-989-0698 K.Tiean",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 45.0,
    "leadTimeDays": 60.0,
    "productScope": "Hand Wrap,Ankle Guard"
  },
  {
    "supplierCode": "ZHUJI",
    "supplierName": "Zhuji Chang Xu Knitting Co., Ltd.",
    "paymentTerms": "deposit30%/beforeshipments70%",
    "currency": "USD",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "pear20110506@163.com",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 60.0,
    "leadTimeDays": 60.0,
    "productScope": "Socks"
  },
  {
    "supplierCode": "JACK",
    "supplierName": "JACK CHIA INDUSTRIES (THAILAND) PUBLIC CO.,LTD.",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "Tell 064-186-6203",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "Tigerplast - Sport Tape - 1 inch"
  },
  {
    "supplierCode": "KTB",
    "supplierName": "Kettlebells And Conditioning Asia Co.,Ltd.",
    "paymentTerms": "monthly sale",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "whatsapp + 66 95 043 8474 Peter for KCA",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "KCA Sweat Bands"
  },
  {
    "supplierCode": "KOMBAT",
    "supplierName": "KOMBAT MOUTHGUARDS",
    "paymentTerms": "monthly sale",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "whatsapp group",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 15.0,
    "leadTimeDays": 15.0,
    "productScope": "Mouth Guard"
  },
  {
    "supplierCode": "KKLOGISTICS",
    "supplierName": "Macnels Duty & Service",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "-",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "service trans"
  },
  {
    "supplierCode": "DHL DUTY",
    "supplierName": "DHL Duty & Service",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "-",
    "shipMode": "-",
    "contactName": "-",
    "contactEmail": "-",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 15.0,
    "productScope": "service trans"
  },
  {
    "supplierCode": "LM001",
    "supplierName": "Longmed",
    "paymentTerms": "1.0",
    "currency": "THB",
    "incoterm": "",
    "shipMode": "",
    "contactName": "",
    "contactEmail": "",
    "moq": "",
    "safetyDays": 15.0,
    "leadTimeDays": 15.0,
    "productScope": ""
  },
  {
    "supplierCode": "FT001",
    "supplierName": "fairtex",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "",
    "shipMode": "",
    "contactName": "khun john",
    "contactEmail": "whatapps group Bangtao Glove Order",
    "moq": "-",
    "safetyDays": 15.0,
    "leadTimeDays": 15.0,
    "productScope": "Muay Thai Gloves"
  },
  {
    "supplierCode": "SSTWINPHUKET001",
    "supplierName": "SSTWINPHUKET001",
    "paymentTerms": "1.0",
    "currency": "THB",
    "incoterm": "",
    "shipMode": "",
    "contactName": "",
    "contactEmail": "",
    "moq": "",
    "safetyDays": 30.0,
    "leadTimeDays": 7.0,
    "productScope": "muay thai glove & hand wraps"
  },
  {
    "supplierCode": "FBTMAIN001",
    "supplierName": "FBTMAIN001",
    "paymentTerms": "pay100%",
    "currency": "THB",
    "incoterm": "",
    "shipMode": "",
    "contactName": "",
    "contactEmail": "",
    "moq": "",
    "safetyDays": 0.0,
    "leadTimeDays": 0.0,
    "productScope": ""
  }
] satisfies ExcelSupplierDetail[];

export const excelIncomingPurchaseOrders = [
  {
    "sku": "100CREA-5000-SMIC-300",
    "activeIncomingQty": 39.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "100CREA-5000-SMIC-500",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "ANGLS-BJ-BLU-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "ANGLS-BJ-BLU-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "ANGLS-BJ-BLU-L",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 90.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "ANGLS-BJ-BLU-M",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 120.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "ANGLS-BJ-BLU-XL",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-BBP-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BBP-3XL",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-BBP-L",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BBP-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BBP-S",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BBP-XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BBP-XS",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-BYP-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 10.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-BYP-3XL",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 40.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-BYP-L",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BYP-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BYP-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BYP-XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-BYP-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-BJ-PWL-2XS",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 20.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-PWL-L",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 10.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-PWL-M",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 10.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-PWL-S",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-PWL-XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 20.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-BJ-PWL-XS",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBC-BP-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-CBC-BP-L",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-CBC-BP-XL",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-CBC-BP-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-CBJ-BLK-2XL",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 10.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-BLK-3XL",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 40.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-BLK-L",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-BLK-M",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-BLK-S",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-CBJ-BLK-XL",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 40.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-WTE-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-WTE-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-WTE-L",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 80.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-WTE-M",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-WTE-S",
    "activeIncomingQty": 0.0,
    "pendingApprovalQty": 20.0,
    "activeStatuses": [],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-CBJ-WTE-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 30.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": [
      "Waiting_for_Approve"
    ]
  },
  {
    "sku": "BT-DFTS-BLK-2XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-BLK-L",
    "activeIncomingQty": 90.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-BLK-M",
    "activeIncomingQty": 80.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-BLK-S",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-BLK-XL",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-WTE-L",
    "activeIncomingQty": 90.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-WTE-M",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-WTE-S",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-DFTS-WTE-XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-ENG-BP-BLK",
    "activeIncomingQty": 410.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-FS-BLK-L",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-FS-BLK-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-FS-BLK-S",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-FS-BLK-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-2XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-3XL",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-L",
    "activeIncomingQty": 150.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-M",
    "activeIncomingQty": 140.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-S",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-XL",
    "activeIncomingQty": 120.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-BLK-XS",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-2XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-3XL",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-L",
    "activeIncomingQty": 150.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-M",
    "activeIncomingQty": 140.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-S",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-XL",
    "activeIncomingQty": 120.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-JSY-ORG-LBL-XS",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-MFTS-BLK-M",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-MFTS-BLK-XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-MFTS-BLU-L",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-MFTS-BLU-S",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-MFTS-BLU-XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-MG-BLK",
    "activeIncomingQty": 1200.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-AWT-BLK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-AWT-BLK-L",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-AWT-BLK-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-AWT-BLK-S",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-AWT-BLK-XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-AWT-BLK-XS",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-BWM-BLK-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-BWM-BLK-L",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-BWM-BLK-M",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-BWM-BLK-S",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-BWM-BLK-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-BWM-BLK-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-MTW-BLK-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-MTW-BLK-L",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-MTW-BLK-S",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-MTW-BLK-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-MTW-BLK-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-BLK-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-BLK-L",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-BLK-M",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-BLK-S",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-BLK-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-BLK-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-OWH-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-OWH-L",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-OWH-M",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-OWH-S",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-OWH-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BT-OST-STS-OWH-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTGC-HAT-BLK",
    "activeIncomingQty": 300.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOG-SING-BLK-KM",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOG-SING-BLK-KS",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOG-SING-BLK-KXS",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery",
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-MTG-BLK-10",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-MTG-BLK-12",
    "activeIncomingQty": 210.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-MTG-BLK-14",
    "activeIncomingQty": 370.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-MTG-BLK-16",
    "activeIncomingQty": 290.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-MTG-BLK-8",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-SG-MC-L",
    "activeIncomingQty": 110.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-SG-MC-M",
    "activeIncomingQty": 170.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTOS2.0-SG-MC-S",
    "activeIncomingQty": 80.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTPE-CTS-BLK-XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTWW-CTS-CRM-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-BRA-BLK-L",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-BRA-BLK-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-HS-BLK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-HS-BLK-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-HS-BLK-L",
    "activeIncomingQty": 80.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-HS-BLK-M",
    "activeIncomingQty": 90.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-HS-BLK-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-HS-BLK-XL",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-RGS-BLK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-RGS-BLK-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-RGS-BLK-L",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-RGS-BLK-M",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-RGS-BLK-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-GRID-RGS-BLK-XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-HWTS-BLK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-HWTS-BLK-L",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-HWTS-BLK-M",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-HWTS-BLK-S",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-HWTS-BLK-XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-HWTS-BLK-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-HS-BLK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-HS-BLK-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-HS-BLK-L",
    "activeIncomingQty": 90.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-HS-BLK-M",
    "activeIncomingQty": 90.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-HS-BLK-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-HS-BLK-XL",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-RGS-BLK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-RGS-BLK-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-RGS-BLK-L",
    "activeIncomingQty": 80.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-RGS-BLK-M",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-RGS-BLK-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "BTXE-RACER-RGS-BLK-XL",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-2XL",
    "activeIncomingQty": 53.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-3XL",
    "activeIncomingQty": 41.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-L",
    "activeIncomingQty": 82.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-M",
    "activeIncomingQty": 73.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-S",
    "activeIncomingQty": 72.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-XL",
    "activeIncomingQty": 84.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-BLK-XS",
    "activeIncomingQty": 11.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-PNK-3XL",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-PNK-L",
    "activeIncomingQty": 19.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-PNK-M",
    "activeIncomingQty": 63.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-PNK-S",
    "activeIncomingQty": 31.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-PNK-XL",
    "activeIncomingQty": 12.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "CORE-MTS-PNK-XS",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "EMBLM-HAT-BLK",
    "activeIncomingQty": 300.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-CHAG-120",
    "activeIncomingQty": 6.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-CORD-120",
    "activeIncomingQty": 11.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-CORD-60",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-LM-60",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-MUSH-60",
    "activeIncomingQty": 4.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-REI-120",
    "activeIncomingQty": 6.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "FB-REI-60",
    "activeIncomingQty": 5.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-L",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-S",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-SHT-MOA-GRN-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-2XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-L",
    "activeIncomingQty": 60.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-M",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-S",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-XL",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HB-TSH-MOA-GRN-XS",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-MHS-MC-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-MHS-MC-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-MHS-MC-L",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-MHS-MC-M",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-MHS-MC-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-MHS-MC-XL",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-SSR-MC-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-SSR-MC-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-SSR-MC-L",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-SSR-MC-M",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-SSR-MC-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "HORI-SSR-MC-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "ISOP-BANANA-2LB",
    "activeIncomingQty": 9.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "MGREEN-TROP-30",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "NAMMAN-OIL-120",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "RWHEY-DCHOC-2LB",
    "activeIncomingQty": 9.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "Delivery"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-NVY-S",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-NVY-XL",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-NVY-XS",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-WTE-2XL",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-WTE-L",
    "activeIncomingQty": 70.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-WTE-M",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-WTE-S",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-WTE-XL",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "TRIB-CTS-WTE-XS",
    "activeIncomingQty": 20.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-MHS-BK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-MHS-BK-L",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-MHS-BK-M",
    "activeIncomingQty": 50.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-MHS-BK-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-MHS-BK-XL",
    "activeIncomingQty": 30.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-SSR-BK-2XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-SSR-BK-3XL",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-SSR-BK-L",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-SSR-BK-M",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-SSR-BK-S",
    "activeIncomingQty": 10.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  },
  {
    "sku": "WARR-SSR-BK-XL",
    "activeIncomingQty": 40.0,
    "pendingApprovalQty": 0.0,
    "activeStatuses": [
      "inpro"
    ],
    "pendingStatuses": []
  }
] satisfies ExcelIncomingPurchaseOrder[];
