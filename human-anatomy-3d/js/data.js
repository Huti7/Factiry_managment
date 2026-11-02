// Descriptions for every structure in the model.
// region: head | neck | trunk | upper | lower      view: thumbnail camera (front | back | side)

export const CATEGORIES = {
  bones: { label: 'Bones', singular: 'Bone', system: 'Skeletal system', color: '#e9dfc6' },
  muscles: { label: 'Muscles', singular: 'Muscle', system: 'Muscular system', color: '#b0453a' },
  nerves: { label: 'Nervous system', singular: 'Nerve structure', system: 'Nervous system', color: '#e0b030' },
};

export const REGIONS = {
  head: 'Head', neck: 'Neck', trunk: 'Trunk', upper: 'Upper limb', lower: 'Lower limb',
};

export const INFO = {
  // ============================ BONES ============================
  skull: {
    name: 'Skull (cranium)', latin: 'Cranium', region: 'head', view: 'front',
    desc: 'The bony case of the head. It protects the brain, houses the eyes, inner ears and nose, and gives attachment to the muscles of the face and jaw.',
    facts: ['Made of 22 bones (8 cranial and 14 facial) joined by immovable joints called sutures.', 'At birth the skull has soft gaps called fontanelles that let it grow with the brain.', 'The only freely movable skull bone is the mandible.'],
    female: 'Female skulls tend to be smaller and smoother, with less prominent brow ridges and a more rounded forehead.',
  },
  mandible: {
    name: 'Mandible', latin: 'Mandibula', region: 'head', view: 'side',
    desc: 'The lower jaw bone – the largest and strongest bone of the face. It holds the lower teeth and moves at the temporomandibular joint.',
    facts: ['It is the only bone of the skull that moves during chewing and speaking.', 'Formed of a horseshoe-shaped body and two vertical rami.', 'The masseter and temporalis muscles that close it are among the strongest in the body.'],
  },
  hyoid: {
    name: 'Hyoid bone', latin: 'Os hyoideum', region: 'neck', view: 'front',
    desc: 'A small U-shaped bone in the front of the neck, just above the larynx. It anchors the tongue and helps with swallowing and speech.',
    facts: ['It is the only bone in the body that does not touch (articulate with) any other bone.', 'It is suspended by muscles and ligaments.', 'A fractured hyoid can be a sign of strangulation in forensic investigations.'],
  },
  atlas: {
    name: 'Atlas (C1)', latin: 'Atlas', region: 'neck', view: 'front',
    desc: 'The first cervical vertebra. It supports the skull and allows the "yes" nodding movement of the head.',
    facts: ['Named after the Titan Atlas, who held up the heavens.', 'Unlike other vertebrae, it has no vertebral body – it is a bony ring.', 'It articulates with the occipital condyles of the skull.'],
  },
  axis: {
    name: 'Axis (C2)', latin: 'Axis', region: 'neck', view: 'front',
    desc: 'The second cervical vertebra. Its tooth-like dens projects upward into the atlas, forming a pivot for turning the head.',
    facts: ['About half of the head\'s side-to-side "no" rotation happens between C1 and C2.', 'The upward projection is called the dens (odontoid process).', 'It has the largest spinous process of the upper cervical vertebrae.'],
  },
  cervical: {
    name: 'Cervical vertebrae (C3–C7)', latin: 'Vertebrae cervicales', region: 'neck', view: 'side',
    desc: 'The small vertebrae of the neck. Together with C1 and C2 they support the head and allow a wide range of neck movement.',
    facts: ['There are 7 cervical vertebrae in almost all mammals – even giraffes.', 'Each has holes in its transverse processes (transverse foramina) for the vertebral arteries.', 'C7 has a long spinous process you can feel at the base of the neck (vertebra prominens).'],
  },
  thoracic: {
    name: 'Thoracic vertebrae (T1–T12)', latin: 'Vertebrae thoracicae', region: 'trunk', view: 'side',
    desc: 'The 12 vertebrae of the upper and middle back. Each one connects with a pair of ribs, forming the back of the rib cage.',
    facts: ['They have facets on their bodies and transverse processes to attach the ribs.', 'Their long spinous processes point steeply downward and overlap like roof tiles.', 'This region forms a natural backward curve called kyphosis.'],
  },
  lumbar: {
    name: 'Lumbar vertebrae (L1–L5)', latin: 'Vertebrae lumbales', region: 'trunk', view: 'side',
    desc: 'The five largest vertebrae, in the lower back. They carry most of the upper-body weight and allow bending forward and backward.',
    facts: ['They have the biggest vertebral bodies of the whole spine.', 'Most back pain originates in the lumbar region.', 'The spinal cord usually ends at about the level of L1–L2.'],
  },
  sacrum: {
    name: 'Sacrum', latin: 'Os sacrum', region: 'trunk', view: 'back',
    desc: 'A triangular bone at the base of the spine formed by five fused vertebrae. It joins the hip bones at the sacroiliac joints to complete the pelvis.',
    facts: ['The five sacral vertebrae fuse between the ages of about 16 and 30.', 'Four pairs of sacral foramina let nerves pass through.', 'Its name comes from Latin "os sacrum" – the "sacred bone".'],
    female: 'In females the sacrum is shorter, wider and less curved, enlarging the pelvic outlet for childbirth.',
  },
  coccyx: {
    name: 'Coccyx (tailbone)', latin: 'Os coccygis', region: 'trunk', view: 'back',
    desc: 'The small tail-like end of the spine, made of 3–5 tiny fused vertebrae. It supports you when sitting and anchors pelvic floor muscles.',
    facts: ['It is a remnant of the tail that human embryos have for a few weeks.', 'The name comes from the Greek word for cuckoo – it resembles a cuckoo\'s beak.', 'A bruised or broken coccyx (coccydynia) can be very painful when sitting.'],
    female: 'The female coccyx is more movable, allowing it to bend backward during childbirth.',
  },
  sternum: {
    name: 'Sternum (breastbone)', latin: 'Sternum', region: 'trunk', view: 'front',
    desc: 'The flat bone in the centre of the chest. Its three parts – manubrium, body and xiphoid process – connect to the clavicles and the costal cartilages of the ribs.',
    facts: ['Chest compressions during CPR are delivered over the lower half of the sternum.', 'It contains red bone marrow and is used for bone marrow biopsies.', 'The xiphoid process often stays cartilaginous until about age 40.'],
  },
  trueRibs: {
    name: 'True ribs (1–7)', latin: 'Costae verae', region: 'trunk', view: 'front',
    desc: 'The first seven pairs of ribs. Each attaches directly to the sternum through its own costal cartilage.',
    facts: ['Ribs move up and out during breathing, like bucket handles.', 'The first rib is the shortest, broadest and most curved.', 'Ribs are flexible and protect the heart and lungs.'],
  },
  falseRibs: {
    name: 'False ribs (8–10)', latin: 'Costae spuriae', region: 'trunk', view: 'front',
    desc: 'Rib pairs 8 to 10. They do not reach the sternum directly – their cartilages join the cartilage of the rib above to form the costal margin.',
    facts: ['Together, their cartilages form the curved lower edge of the chest (costal arch).', 'They help protect the liver, stomach and spleen.', 'They are the ribs most often bruised in falls.'],
  },
  floatingRibs: {
    name: 'Floating ribs (11–12)', latin: 'Costae fluctuantes', region: 'trunk', view: 'back',
    desc: 'The last two pairs of ribs. They attach only to the vertebrae at the back and end freely in the muscles of the abdominal wall.',
    facts: ['They have no anterior attachment at all.', 'They partly protect the kidneys.', 'Some people have an extra (13th) rib, or a cervical rib in the neck.'],
  },
  clavicle: {
    name: 'Clavicle (collarbone)', latin: 'Clavicula', region: 'upper', view: 'front',
    desc: 'An S-shaped bone that connects the sternum to the shoulder blade. It acts as a strut holding the arm away from the body.',
    facts: ['It is the most commonly broken bone in the body.', 'It is the first bone to start ossifying in the embryo (about week 5).', 'It is the only long bone that lies horizontally.'],
  },
  scapula: {
    name: 'Scapula (shoulder blade)', latin: 'Scapula', region: 'upper', view: 'back',
    desc: 'A flat triangular bone on the upper back. Its shallow glenoid cavity forms the shoulder joint with the humerus, and 17 muscles attach to it.',
    facts: ['It "floats" on the back of the rib cage, held only by muscles.', 'Its bony ridge (spine) ends in the acromion – the tip of the shoulder.', 'The rotator cuff muscles arise from the scapula.'],
  },
  humerus: {
    name: 'Humerus', latin: 'Humerus', region: 'upper', view: 'front',
    desc: 'The long bone of the upper arm. Its rounded head fits into the shoulder socket, and its lower end forms the elbow joint with the radius and ulna.',
    facts: ['The "funny bone" is actually the ulnar nerve passing behind the humerus\'s medial epicondyle.', 'The radial nerve runs in a spiral groove on its back.', 'It is the largest bone of the upper limb.'],
  },
  ulna: {
    name: 'Ulna', latin: 'Ulna', region: 'upper', view: 'front',
    desc: 'The forearm bone on the little-finger side. Its hooked upper end (olecranon) forms the point of the elbow.',
    facts: ['It is longer than the radius.', 'The olecranon is what you lean on when you rest on your elbows.', 'It forms a hinge with the humerus that allows the elbow to bend.'],
  },
  radius: {
    name: 'Radius', latin: 'Radius', region: 'upper', view: 'front',
    desc: 'The forearm bone on the thumb side. It rotates around the ulna so you can turn your palm up and down.',
    facts: ['The distal radius fracture ("Colles\' fracture") is common when falling on an outstretched hand.', 'Its rotation produces pronation and supination of the forearm.', 'Its wide lower end forms most of the wrist joint.'],
  },
  carpals: {
    name: 'Carpal bones (wrist)', latin: 'Ossa carpi', region: 'upper', view: 'front',
    desc: 'Eight small bones arranged in two rows that make up the wrist and give it flexibility.',
    facts: ['Proximal row: scaphoid, lunate, triquetrum, pisiform; distal row: trapezium, trapezoid, capitate, hamate.', 'The scaphoid is the most frequently fractured wrist bone.', 'Together they form the floor of the carpal tunnel.'],
  },
  metacarpals: {
    name: 'Metacarpals', latin: 'Ossa metacarpi', region: 'upper', view: 'front',
    desc: 'Five long bones that form the palm of the hand, between the wrist and the fingers.',
    facts: ['Their heads form the knuckles.', 'A broken 5th metacarpal is called a "boxer\'s fracture".', 'The thumb metacarpal has a saddle joint that allows opposition.'],
  },
  handPhalanges: {
    name: 'Phalanges of the hand', latin: 'Phalanges manus', region: 'upper', view: 'front',
    desc: 'The 14 finger bones. Each finger has three phalanges (proximal, middle and distal); the thumb has only two.',
    facts: ['Each hand has 27 bones in total.', 'The distal phalanges support the fingernails and sensitive fingertips.', 'Fingers have no muscles inside – they are moved by tendons from the forearm and palm.'],
  },
  hipBone: {
    name: 'Hip bone (os coxae)', latin: 'Os coxae', region: 'trunk', view: 'front',
    desc: 'The large bone of the pelvis, formed by three fused bones – ilium, ischium and pubis – that meet at the hip socket (acetabulum).',
    facts: ['The ilium, ischium and pubis fuse around age 15–17.', 'You sit on the ischial tuberosities ("sit bones").', 'The two hip bones meet in front at the pubic symphysis.'],
    female: 'The female pelvis is wider and shallower, with a round inlet and a wider subpubic angle (about 80–90° vs 50–60° in males) to allow childbirth.',
  },
  femur: {
    name: 'Femur (thigh bone)', latin: 'Femur', region: 'lower', view: 'front',
    desc: 'The longest and strongest bone in the body. It connects the hip to the knee and carries the body\'s weight while walking and running.',
    facts: ['It is about one quarter of a person\'s height.', 'It can withstand forces of several times body weight.', 'The femoral neck is a common fracture site in older people with osteoporosis.'],
    female: 'Because of the wider pelvis, the female femur slopes inward more steeply toward the knee (a larger Q-angle).',
  },
  patella: {
    name: 'Patella (kneecap)', latin: 'Patella', region: 'lower', view: 'front',
    desc: 'A triangular bone embedded in the tendon of the quadriceps. It protects the knee and increases the leverage of the thigh muscles.',
    facts: ['It is the largest sesamoid bone (a bone that grows inside a tendon).', 'Babies are born with a cartilage kneecap that ossifies at 3–5 years.', 'It glides in a groove at the bottom of the femur.'],
  },
  tibia: {
    name: 'Tibia (shin bone)', latin: 'Tibia', region: 'lower', view: 'front',
    desc: 'The large, weight-bearing bone of the lower leg. Its sharp front edge is the shin, and its lower end forms the inner ankle bump (medial malleolus).',
    facts: ['It is the second longest bone in the body.', 'Its front surface lies directly under the skin – which is why knocks on the shin hurt so much.', 'It carries about 85–90% of the body weight transmitted through the leg.'],
  },
  fibula: {
    name: 'Fibula', latin: 'Fibula', region: 'lower', view: 'side',
    desc: 'The thin bone on the outer side of the lower leg. It is mainly an attachment for muscles and forms the outer ankle bump (lateral malleolus).',
    facts: ['It bears only a small part of the body weight.', 'Pieces of the fibula are often used as bone grafts.', 'Its name means "brooch" or "pin" in Latin.'],
  },
  talus: {
    name: 'Talus', latin: 'Talus', region: 'lower', view: 'side',
    desc: 'The ankle bone that sits between the tibia/fibula and the heel bone. It transmits the whole body weight from the leg to the foot.',
    facts: ['No muscles attach to the talus.', 'About 60% of its surface is covered by joint cartilage.', 'It forms the ankle joint (talocrural joint) above and the subtalar joint below.'],
  },
  calcaneus: {
    name: 'Calcaneus (heel bone)', latin: 'Calcaneus', region: 'lower', view: 'side',
    desc: 'The largest bone of the foot, forming the heel. The Achilles tendon attaches to its back.',
    facts: ['It is the first part of the foot to hit the ground when walking.', 'Calcaneus fractures often happen after falls from a height.', 'Heel spurs can form where the plantar fascia attaches.'],
  },
  tarsals: {
    name: 'Navicular, cuboid & cuneiforms', latin: 'Ossa tarsi', region: 'lower', view: 'front',
    desc: 'The smaller tarsal bones of the midfoot that build the arches of the foot together with the talus and calcaneus.',
    facts: ['The foot has 7 tarsal bones in total.', 'The three cuneiforms are wedge-shaped, helping form the transverse arch.', 'The cuboid has a groove for the fibularis longus tendon.'],
  },
  metatarsals: {
    name: 'Metatarsals', latin: 'Ossa metatarsi', region: 'lower', view: 'front',
    desc: 'Five long bones in the middle of the foot that connect the tarsals to the toes.',
    facts: ['The 1st metatarsal (big toe) is the shortest and thickest.', 'Stress fractures of the 2nd metatarsal are common in runners ("march fracture").', 'Their heads form the ball of the foot.'],
  },
  footPhalanges: {
    name: 'Phalanges of the foot', latin: 'Phalanges pedis', region: 'lower', view: 'front',
    desc: 'The 14 toe bones. The big toe (hallux) has two phalanges and the other toes have three each.',
    facts: ['Each foot has 26 bones – together the feet contain about a quarter of all bones in the body.', 'The big toe carries much of the push-off force when walking.', 'The small toe\'s middle and distal phalanges are often fused.'],
  },

  costalCartilages: {
    name: 'Costal cartilages', latin: 'Cartilagines costales', region: 'trunk', view: 'front',
    desc: 'Bars of hyaline cartilage that join the front ends of the ribs to the sternum. They give the rib cage its springiness.',
    facts: ['They let the chest expand during breathing.', 'They often calcify (turn bony) with age.', 'Ribs 8–10 share cartilages that form the curved costal margin.'],
  },
  discs: {
    name: 'Intervertebral discs', latin: 'Disci intervertebrales', region: 'trunk', view: 'side',
    desc: 'Fibrocartilage cushions between the vertebral bodies. Each has a tough outer ring (annulus fibrosus) and a soft gel-like core (nucleus pulposus).',
    facts: ['They make up about a quarter of the length of the spine.', 'You are about 1 cm taller in the morning because the discs re-hydrate overnight.', 'A "slipped disc" is a herniation of the soft core that can press on a nerve.'],
  },

  // ============================ MUSCLES ============================
  frontalis: {
    name: 'Frontalis', latin: 'Venter frontalis m. occipitofrontalis', region: 'head', view: 'front',
    desc: 'A thin muscle sheet covering the forehead. It raises the eyebrows and wrinkles the forehead.',
    facts: ['It has no bony attachment at its lower end – it inserts into the skin of the eyebrows.', 'It is part of the occipitofrontalis, linked by a tendon sheet over the skull (galea aponeurotica).', 'Supplied by the facial nerve (CN VII).'],
  },
  temporalis: {
    name: 'Temporalis', latin: 'Musculus temporalis', region: 'head', view: 'side',
    desc: 'A fan-shaped chewing muscle on the side of the head. It closes the jaw and pulls it backward.',
    facts: ['You can feel it contract at your temple when you clench your teeth.', 'Its tendon passes beneath the zygomatic arch to the mandible\'s coronoid process.', 'Supplied by the mandibular branch of the trigeminal nerve.'],
  },
  masseter: {
    name: 'Masseter', latin: 'Musculus masseter', region: 'head', view: 'side',
    desc: 'The main chewing muscle, running from the cheekbone to the angle of the jaw. It powerfully closes the mouth.',
    facts: ['Relative to its size, it is often called the strongest muscle in the body.', 'It can produce a bite force of over 70 kg on the molars.', 'Teeth grinding (bruxism) can make it enlarge.'],
  },
  orbicularisOculi: {
    name: 'Orbicularis oculi', latin: 'Musculus orbicularis oculi', region: 'head', view: 'front',
    desc: 'A ring-shaped muscle surrounding the eye. It closes the eyelids for blinking, squinting and tight closing.',
    facts: ['We blink about 15–20 times per minute.', 'Its contraction creates "crow\'s feet" wrinkles.', 'Paralysis of this muscle (e.g. in Bell\'s palsy) prevents the eye from closing.'],
  },
  zygomaticus: {
    name: 'Zygomaticus major', latin: 'Musculus zygomaticus major', region: 'head', view: 'front',
    desc: 'The "smiling muscle". It pulls the corners of the mouth upward and outward.',
    facts: ['A split (bifid) zygomaticus major is thought to cause cheek dimples.', 'A genuine "Duchenne" smile uses both the zygomaticus major and orbicularis oculi.', 'Supplied by the facial nerve.'],
  },
  sternocleidomastoid: {
    name: 'Sternocleidomastoid', latin: 'Musculus sternocleidomastoideus', region: 'neck', view: 'side',
    desc: 'A long neck muscle running from behind the ear to the sternum and clavicle. It turns the head and flexes the neck.',
    facts: ['Turning the head to the left uses the RIGHT sternocleidomastoid.', 'It divides the neck into anterior and posterior triangles used by surgeons.', 'It also helps lift the rib cage during forced breathing.'],
  },
  trapezius: {
    name: 'Trapezius', latin: 'Musculus trapezius', region: 'trunk', view: 'back',
    desc: 'A large diamond-shaped muscle of the upper back and neck. It moves, rotates and stabilises the shoulder blade and helps extend the head.',
    facts: ['Its upper fibres shrug the shoulders.', 'Together, both sides form a trapezoid (diamond) shape – hence the name.', 'It is supplied by the accessory nerve (CN XI).'],
  },
  deltoid: {
    name: 'Deltoid', latin: 'Musculus deltoideus', region: 'upper', view: 'side',
    desc: 'The rounded muscle cap of the shoulder. It lifts the arm out to the side and also moves it forward and backward.',
    facts: ['It is named after the Greek letter delta (Δ) because of its triangular shape.', 'It has anterior, middle and posterior parts.', 'It is a common site for vaccine injections.'],
  },
  pectoralisMajor: {
    name: 'Pectoralis major', latin: 'Musculus pectoralis major', region: 'trunk', view: 'front',
    desc: 'The large fan-shaped chest muscle. It pulls the arm across the body, rotates it inward and helps push.',
    facts: ['It has a clavicular head and a sternocostal head.', 'Push-ups and bench presses train this muscle.', 'Its fibres twist before inserting on the humerus.'],
    female: 'In females the breast (mammary gland and fat) lies on top of the pectoralis major.',
  },
  serratusAnterior: {
    name: 'Serratus anterior', latin: 'Musculus serratus anterior', region: 'trunk', view: 'side',
    desc: 'A saw-toothed muscle on the side of the rib cage. It holds the shoulder blade against the ribs and rotates it so you can lift your arm overhead.',
    facts: ['Nicknamed the "boxer\'s muscle" because it powers punching.', 'Damage to its nerve (long thoracic nerve) causes a "winged scapula".', '"Serratus" means saw-toothed in Latin.'],
  },
  rectusAbdominis: {
    name: 'Rectus abdominis', latin: 'Musculus rectus abdominis', region: 'trunk', view: 'front',
    desc: 'A pair of long, flat muscles running down the front of the abdomen. They flex the trunk and support the abdominal organs.',
    facts: ['Tendinous intersections divide it into the famous "six-pack" segments.', 'It is wrapped in the rectus sheath formed by other abdominal muscles.', 'The left and right muscles are separated by the linea alba.'],
  },
  externalOblique: {
    name: 'External oblique', latin: 'Musculus obliquus externus abdominis', region: 'trunk', view: 'side',
    desc: 'The largest and most superficial flat muscle on the side of the abdomen. It twists and bends the trunk and compresses the abdomen.',
    facts: ['Its fibres run down and forward, like hands in your front pockets.', 'Its lower edge forms the inguinal ligament.', 'It works with the opposite internal oblique to rotate the trunk.'],
  },
  internalOblique: {
    name: 'Internal oblique', latin: 'Musculus obliquus internus abdominis', region: 'trunk', view: 'side',
    desc: 'The middle layer of the flat abdominal muscles, lying under the external oblique. Its fibres run up and forward at right angles to the external oblique.',
    facts: ['It rotates the trunk to the same side (the external oblique rotates it to the opposite side).', 'It helps compress the abdomen when coughing or lifting.', 'In males its lowest fibres form the cremaster muscle around the spermatic cord.'],
  },
  latissimusDorsi: {
    name: 'Latissimus dorsi', latin: 'Musculus latissimus dorsi', region: 'trunk', view: 'back',
    desc: 'The broadest muscle of the back. It pulls the arm down and back and rotates it inward – the main muscle for pull-ups and swimming.',
    facts: ['Its name means "broadest of the back".', 'It connects the spine and pelvis to the arm.', 'Surgeons can use it as a muscle flap for breast reconstruction.'],
  },
  erectorSpinae: {
    name: 'Erector spinae', latin: 'Musculus erector spinae', region: 'trunk', view: 'back',
    desc: 'A group of long muscles (iliocostalis, longissimus and spinalis) running along both sides of the spine. They straighten and support the back.',
    facts: ['They keep the body upright against gravity.', 'They extend from the sacrum all the way to the skull.', 'Weak or strained erector spinae is a common cause of lower back pain.'],
  },
  diaphragm: {
    name: 'Diaphragm', latin: 'Diaphragma', region: 'trunk', view: 'front',
    desc: 'A dome-shaped sheet of muscle separating the chest from the abdomen. It is the main muscle of breathing.',
    facts: ['When it contracts, the dome flattens and air is drawn into the lungs.', 'Hiccups are sudden involuntary spasms of the diaphragm.', 'It is supplied by the phrenic nerve, which arises from neck roots C3–C5.'],
  },
  biceps: {
    name: 'Biceps brachii', latin: 'Musculus biceps brachii', region: 'upper', view: 'front',
    desc: 'The two-headed muscle on the front of the upper arm. It bends the elbow and turns the palm upward (supination).',
    facts: ['"Biceps" means two heads – a long head and a short head.', 'It is the strongest supinator of the forearm.', 'Its long-head tendon runs through the shoulder joint.'],
  },
  brachialis: {
    name: 'Brachialis', latin: 'Musculus brachialis', region: 'upper', view: 'side',
    desc: 'A muscle lying underneath the biceps. It is the main flexor of the elbow in every forearm position.',
    facts: ['It is actually a stronger elbow flexor than the biceps.', 'It attaches to the ulna, so it is not affected by forearm rotation.', 'It is sometimes called the "workhorse" of elbow flexion.'],
  },
  triceps: {
    name: 'Triceps brachii', latin: 'Musculus triceps brachii', region: 'upper', view: 'back',
    desc: 'The three-headed muscle on the back of the upper arm. It straightens the elbow.',
    facts: ['It makes up about two-thirds of the upper arm\'s muscle mass.', 'Its heads are the long, lateral and medial heads.', 'It inserts on the olecranon of the ulna.'],
  },
  brachioradialis: {
    name: 'Brachioradialis', latin: 'Musculus brachioradialis', region: 'upper', view: 'side',
    desc: 'A forearm muscle on the thumb side that bends the elbow, especially with the thumb pointing up (hammer grip).',
    facts: ['It forms the outer border of the elbow pit (cubital fossa).', 'It is supplied by the radial nerve even though it flexes the elbow.', 'It is easily seen when you lift a mug.'],
  },
  forearmFlexors: {
    name: 'Forearm flexor group', latin: 'Musculi flexores antebrachii', region: 'upper', view: 'front',
    desc: 'Muscles on the palm side of the forearm (e.g. flexor carpi radialis, palmaris longus, flexor digitorum). They bend the wrist and fingers.',
    facts: ['Most arise from the medial epicondyle of the humerus – the "common flexor origin".', 'Overuse causes "golfer\'s elbow".', 'About 15% of people lack the palmaris longus muscle.'],
  },
  forearmExtensors: {
    name: 'Forearm extensor group', latin: 'Musculi extensores antebrachii', region: 'upper', view: 'back',
    desc: 'Muscles on the back of the forearm that straighten the wrist and fingers.',
    facts: ['Most start from the lateral epicondyle of the humerus.', 'Overuse causes "tennis elbow" (lateral epicondylitis).', 'All are supplied by the radial nerve.'],
  },
  gluteusMaximus: {
    name: 'Gluteus maximus', latin: 'Musculus gluteus maximus', region: 'lower', view: 'back',
    desc: 'The largest muscle in the human body, forming the buttock. It extends the hip for climbing, running and rising from sitting.',
    facts: ['Its size is a unique human adaptation for upright walking.', 'It is mostly quiet during walking but very active when climbing stairs or sprinting.', 'It is supplied by the inferior gluteal nerve.'],
    female: 'Females typically carry more fat over the gluteal region, giving the hips a rounder contour.',
  },
  gluteusMedius: {
    name: 'Gluteus medius', latin: 'Musculus gluteus medius', region: 'lower', view: 'side',
    desc: 'A fan-shaped muscle on the outer surface of the pelvis. It moves the leg out to the side and keeps the pelvis level when you stand on one leg.',
    facts: ['Weakness causes the hip to drop when walking (Trendelenburg sign).', 'It is a key muscle for balance.', 'It inserts on the greater trochanter of the femur.'],
  },
  iliopsoas: {
    name: 'Iliopsoas', latin: 'Musculus iliopsoas', region: 'lower', view: 'front',
    desc: 'The combination of psoas major and iliacus. It is the strongest hip flexor, lifting the thigh toward the trunk.',
    facts: ['The psoas starts on the lumbar vertebrae, deep inside the abdomen.', 'It inserts on the lesser trochanter of the femur.', 'Long periods of sitting can make it short and tight.'],
  },
  sartorius: {
    name: 'Sartorius', latin: 'Musculus sartorius', region: 'lower', view: 'front',
    desc: 'A long, strap-like muscle that crosses the thigh diagonally. It helps flex, rotate and abduct the hip and bend the knee.',
    facts: ['It is the longest muscle in the human body.', 'Named after the Latin "sartor" (tailor), from the cross-legged tailor\'s sitting position.', 'Its tendon joins gracilis and semitendinosus at the "pes anserinus".'],
  },
  rectusFemoris: {
    name: 'Rectus femoris', latin: 'Musculus rectus femoris', region: 'lower', view: 'front',
    desc: 'The central quadriceps muscle on the front of the thigh. It straightens the knee and also flexes the hip.',
    facts: ['It is the only quadriceps muscle that crosses both the hip and the knee.', 'It is often strained when kicking a ball.', 'All four quadriceps join in the patellar tendon.'],
  },
  vastusLateralis: {
    name: 'Vastus lateralis', latin: 'Musculus vastus lateralis', region: 'lower', view: 'side',
    desc: 'The largest of the four quadriceps muscles, on the outer side of the thigh. It straightens the knee.',
    facts: ['It is the most common site for muscle biopsies.', 'It is a common injection site in infants.', 'It helps stabilise the kneecap.'],
  },
  vastusMedialis: {
    name: 'Vastus medialis', latin: 'Musculus vastus medialis', region: 'lower', view: 'front',
    desc: 'The teardrop-shaped quadriceps muscle on the inner thigh just above the knee. It straightens the knee and steadies the kneecap.',
    facts: ['Its lowest fibres (VMO) pull the patella inward to keep it on track.', 'It is often weak after knee injuries.', 'It is most active in the final degrees of knee extension.'],
  },
  adductors: {
    name: 'Adductor group', latin: 'Musculi adductores', region: 'lower', view: 'front',
    desc: 'Muscles on the inner thigh (adductor longus, brevis and magnus) that pull the legs together.',
    facts: ['A "groin strain" is usually an injury to the adductor longus.', 'Adductor magnus is one of the largest muscles of the body.', 'Most are supplied by the obturator nerve.'],
  },
  gracilis: {
    name: 'Gracilis', latin: 'Musculus gracilis', region: 'lower', view: 'front',
    desc: 'A long, thin muscle on the inner thigh. It pulls the thigh inward and helps bend the knee.',
    facts: ['"Gracilis" means slender in Latin.', 'Surgeons often use it as a graft because it can be removed with little loss of function.', 'Part of the pes anserinus insertion on the tibia.'],
  },
  bicepsFemoris: {
    name: 'Biceps femoris', latin: 'Musculus biceps femoris', region: 'lower', view: 'back',
    desc: 'The outer hamstring muscle at the back of the thigh. It bends the knee and extends the hip.',
    facts: ['It has a long head and a short head.', 'It is the most frequently injured hamstring in sprinters.', 'It inserts on the head of the fibula.'],
  },
  semitendinosus: {
    name: 'Semitendinosus', latin: 'Musculus semitendinosus', region: 'lower', view: 'back',
    desc: 'An inner hamstring muscle with a long tendon. It bends the knee, extends the hip and rotates the leg inward.',
    facts: ['Its name refers to its long tendon making up half its length.', 'Its tendon is commonly used to rebuild a torn ACL.', 'It lies on top of the semimembranosus muscle.'],
  },
  gastrocnemius: {
    name: 'Gastrocnemius', latin: 'Musculus gastrocnemius', region: 'lower', view: 'back',
    desc: 'The two-headed calf muscle. It points the foot (plantar flexion) and helps bend the knee.',
    facts: ['It gives the calf its rounded shape.', 'It is mostly made of fast-twitch fibres for jumping and sprinting.', 'It joins the soleus to form the Achilles tendon.'],
  },
  soleus: {
    name: 'Soleus', latin: 'Musculus soleus', region: 'lower', view: 'back',
    desc: 'A broad flat calf muscle under the gastrocnemius. It points the foot and keeps you from falling forward when standing.',
    facts: ['It is rich in slow-twitch fibres, built for endurance.', 'Its contractions pump blood back up the leg – it is called the "second heart".', 'Named after the sole fish because of its flat shape.'],
  },
  achilles: {
    name: 'Achilles (calcaneal) tendon', latin: 'Tendo calcaneus', region: 'lower', view: 'back',
    desc: 'The thick tendon connecting the calf muscles to the heel bone. It transmits the force for walking, running and jumping.',
    facts: ['It is the thickest and strongest tendon in the body.', 'It can bear loads of up to 10 times body weight when running.', 'Named after the Greek hero Achilles, whose heel was his only weak spot.'],
  },
  tibialisAnterior: {
    name: 'Tibialis anterior', latin: 'Musculus tibialis anterior', region: 'lower', view: 'front',
    desc: 'The muscle beside the shin bone. It lifts the foot upward (dorsiflexion) and turns the sole inward.',
    facts: ['It prevents the toes from dragging while walking.', 'Weakness causes "foot drop".', 'Shin splints often involve this muscle.'],
  },
  fibularisLongus: {
    name: 'Fibularis (peroneus) longus & brevis', latin: 'Musculi fibulares longus et brevis', region: 'lower', view: 'side',
    desc: 'A muscle on the outer side of the lower leg. It turns the sole outward (eversion) and supports the arches of the foot.',
    facts: ['Its tendon passes behind the outer ankle and crosses under the sole of the foot.', 'It helps prevent ankle sprains.', 'Supplied by the superficial fibular nerve.'],
  },

  orbicularisOris: {
    name: 'Orbicularis oris', latin: 'Musculus orbicularis oris', region: 'head', view: 'front',
    desc: 'The ring of muscle around the lips. It closes and purses the mouth.',
    facts: ['It is used for kissing, whistling and playing wind instruments.', 'It is the hub where many facial muscles meet.', 'Supplied by the facial nerve.'],
  },
  scalenes: {
    name: 'Scalenes', latin: 'Musculi scaleni', region: 'neck', view: 'side',
    desc: 'Three muscles (anterior, middle and posterior) on the side of the neck running to the first two ribs. They bend the neck and lift the ribs.',
    facts: ['They are accessory muscles of breathing.', 'The brachial plexus passes between the anterior and middle scalenes.', 'Tight scalenes can compress nerves to the arm (thoracic outlet syndrome).'],
  },
  levatorScapulae: {
    name: 'Levator scapulae', latin: 'Musculus levator scapulae', region: 'neck', view: 'back',
    desc: 'A strap-like muscle at the back and side of the neck that lifts the shoulder blade.',
    facts: ['Its name means "lifter of the scapula".', 'It is a common source of neck stiffness.', 'It runs from the upper cervical vertebrae to the superior angle of the scapula.'],
  },
  spleniusCapitis: {
    name: 'Splenius capitis', latin: 'Musculus splenius capitis', region: 'neck', view: 'back',
    desc: 'A broad muscle at the back of the neck. It extends the head and turns it to the same side.',
    facts: ['Its name comes from the Greek for "bandage".', 'It lies under the trapezius and sternocleidomastoid.', 'Whiplash injuries often strain it.'],
  },
  infrahyoid: {
    name: 'Infrahyoid (strap) muscles', latin: 'Musculi infrahyoidei', region: 'neck', view: 'front',
    desc: 'Thin, ribbon-like muscles in the front of the neck (such as sternohyoid) that pull the hyoid bone and larynx down after swallowing.',
    facts: ['There are four on each side: sternohyoid, sternothyroid, thyrohyoid and omohyoid.', 'They help with swallowing and speaking.', 'Surgeons move them aside to reach the thyroid gland.'],
  },
  rhomboids: {
    name: 'Rhomboids', latin: 'Musculi rhomboidei', region: 'trunk', view: 'back',
    desc: 'Rhombus-shaped muscles between the spine and the shoulder blade. They pull the shoulder blades together.',
    facts: ['They have a major and a minor part.', 'They lie underneath the trapezius.', 'Good posture depends on them.'],
  },
  supraspinatus: {
    name: 'Supraspinatus', latin: 'Musculus supraspinatus', region: 'upper', view: 'back',
    desc: 'A rotator cuff muscle above the spine of the scapula. It starts lifting the arm out to the side and holds the humerus in its socket.',
    facts: ['It is the most commonly torn rotator cuff tendon.', 'Its tendon passes under the acromion, where it can be pinched (impingement).', 'It is one of the four "SITS" rotator cuff muscles.'],
  },
  infraspinatus: {
    name: 'Infraspinatus', latin: 'Musculus infraspinatus', region: 'upper', view: 'back',
    desc: 'A thick triangular rotator cuff muscle below the spine of the scapula. It rotates the arm outward and stabilises the shoulder.',
    facts: ['It is the main external rotator of the shoulder.', 'It is heavily used in throwing sports.', 'It is supplied by the suprascapular nerve.'],
  },
  teresMinor: {
    name: 'Teres minor', latin: 'Musculus teres minor', region: 'upper', view: 'back',
    desc: 'A small rotator cuff muscle along the outer border of the scapula. It rotates the arm outward.',
    facts: ['"Teres" means rounded.', 'It is supplied by the axillary nerve.', 'It works together with the infraspinatus.'],
  },
  teresMajor: {
    name: 'Teres major', latin: 'Musculus teres major', region: 'upper', view: 'back',
    desc: 'A thick muscle from the lower angle of the scapula to the front of the humerus. It pulls the arm down and back and rotates it inward.',
    facts: ['It is nicknamed "lat\'s little helper".', 'It is not part of the rotator cuff.', 'It forms part of the back wall of the armpit.'],
  },
  intercostals: {
    name: 'Intercostal muscles', latin: 'Musculi intercostales', region: 'trunk', view: 'side',
    desc: 'Thin layers of muscle filling the spaces between the ribs. They move the ribs during breathing and stiffen the chest wall.',
    facts: ['There are external, internal and innermost layers.', 'External intercostals help breathe in; internal ones help breathe out forcefully.', 'Intercostal nerves and vessels run between the layers.'],
  },
  tensorFasciaeLatae: {
    name: 'Tensor fasciae latae', latin: 'Musculus tensor fasciae latae', region: 'lower', view: 'side',
    desc: 'A small muscle at the front-outer hip. It tightens the iliotibial band and helps flex and abduct the hip.',
    facts: ['It helps keep the knee stable while walking.', 'It works closely with the gluteus maximus.', 'It is often tight in runners.'],
  },
  iliotibialBand: {
    name: 'Iliotibial band', latin: 'Tractus iliotibialis', region: 'lower', view: 'side',
    desc: 'A thick band of fibrous tissue running down the outside of the thigh from the hip to the tibia. It stabilises the hip and knee.',
    facts: ['IT band syndrome causes pain on the outside of the knee in runners and cyclists.', 'It is a thickening of the fascia lata that wraps the thigh.', 'It can be felt as a firm strip on the side of the thigh.'],
  },
  patellarLigament: {
    name: 'Quadriceps tendon & patellar ligament', latin: 'Ligamentum patellae', region: 'lower', view: 'front',
    desc: 'The strong tendon that connects the quadriceps to the kneecap and continues from the kneecap to the tibial tuberosity.',
    facts: ['A doctor taps it with a hammer to test the knee-jerk reflex.', 'It transmits all the force of the quadriceps.', 'Its middle third is often used to rebuild a torn ACL.'],
  },
  semimembranosus: {
    name: 'Semimembranosus', latin: 'Musculus semimembranosus', region: 'lower', view: 'back',
    desc: 'The deepest and broadest of the inner hamstrings. It bends the knee and extends the hip.',
    facts: ['It is named after its flat, membrane-like upper tendon.', 'It lies beneath the semitendinosus.', 'It helps stabilise the back of the knee.'],
  },
  extensorDigitorumLongus: {
    name: 'Extensor digitorum longus', latin: 'Musculus extensor digitorum longus', region: 'lower', view: 'front',
    desc: 'A muscle on the front of the leg whose four tendons fan out over the top of the foot to lift toes 2–5.',
    facts: ['Its tendons are easy to see when you lift your toes.', 'It also helps lift the foot.', 'Supplied by the deep fibular nerve.'],
  },
  handMuscles: {
    name: 'Hand muscles', latin: 'Musculi manus', region: 'upper', view: 'front',
    desc: 'The small intrinsic muscles of the hand: the thenar group (thumb ball), the hypothenar group (little-finger side) and the interossei and lumbricals between the bones.',
    facts: ['They control fine finger movements such as writing.', 'The thenar muscles make the human opposable thumb possible.', 'Wasting of the thenar eminence is a sign of carpal tunnel syndrome.'],
  },
  footMuscles: {
    name: 'Foot muscles', latin: 'Musculi pedis', region: 'lower', view: 'side',
    desc: 'The intrinsic muscles of the foot, such as abductor hallucis, flexor digitorum brevis and extensor digitorum brevis. They support the arches and move the toes.',
    facts: ['The sole has four layers of muscles.', 'They work constantly to keep you balanced.', 'Weak foot muscles are linked to flat feet.'],
  },

  // ============================ NERVOUS SYSTEM ============================
  cerebrum: {
    name: 'Cerebrum', latin: 'Cerebrum', region: 'head', view: 'side',
    desc: 'The largest part of the brain, made of two hemispheres. It controls thought, memory, language, voluntary movement and the senses.',
    facts: ['It has about 16 billion neurons in its folded outer layer (cortex).', 'The left hemisphere controls the right side of the body, and vice versa.', 'Its folds (gyri) and grooves (sulci) triple the cortex surface area.'],
    female: 'On average the male brain is slightly larger in volume, roughly in proportion to body size; there is no difference in general intelligence.',
  },
  cerebellum: {
    name: 'Cerebellum', latin: 'Cerebellum', region: 'head', view: 'back',
    desc: 'The "little brain" at the back of the skull. It coordinates movement, balance, posture and motor learning.',
    facts: ['It is only about 10% of brain volume but contains over half of all brain neurons.', 'Alcohol affects it, causing clumsy, unsteady walking.', 'Its finely folded surface looks like the leaves of a tree (arbor vitae inside).'],
  },
  brainstem: {
    name: 'Brainstem', latin: 'Truncus encephali', region: 'head', view: 'side',
    desc: 'The stalk connecting the brain to the spinal cord, made of the midbrain, pons and medulla. It controls vital functions such as breathing, heart rate and consciousness.',
    facts: ['10 of the 12 cranial nerves emerge from the brainstem.', 'It contains the centres for breathing and blood pressure.', 'Damage here can be life-threatening.'],
  },
  spinalCord: {
    name: 'Spinal cord', latin: 'Medulla spinalis', region: 'trunk', view: 'back',
    desc: 'A long bundle of nerve tissue running down the vertebral canal. It carries messages between the brain and body and controls reflexes.',
    facts: ['It is about 45 cm long in men and 43 cm in women.', 'It ends at about L1–L2, where it tapers into the conus medullaris.', 'It is protected by the vertebrae, three membranes (meninges) and cerebrospinal fluid.'],
  },
  caudaEquina: {
    name: 'Cauda equina', latin: 'Cauda equina', region: 'trunk', view: 'back',
    desc: 'The bundle of nerve roots that continues down the spinal canal below the end of the spinal cord. It supplies the legs, bladder and bowel.',
    facts: ['Its name means "horse\'s tail" in Latin.', 'Lumbar punctures are done below L2 to avoid the spinal cord.', 'Compression (cauda equina syndrome) is a surgical emergency.'],
  },
  eyeOptic: {
    name: 'Eye & optic nerve (CN II)', latin: 'Bulbus oculi & nervus opticus', region: 'head', view: 'front',
    desc: 'The eye converts light into nerve signals, which the optic nerve carries to the brain. The two optic nerves partly cross at the optic chiasm.',
    facts: ['Each optic nerve has about 1.2 million nerve fibres.', 'The retina is actually an outgrowth of the brain.', 'The point where the nerve leaves the eye creates a blind spot.'],
  },
  trigeminal: {
    name: 'Trigeminal nerve (CN V)', latin: 'Nervus trigeminus', region: 'head', view: 'front',
    desc: 'The fifth cranial nerve. Its three branches (ophthalmic, maxillary and mandibular) give sensation to the face and control the chewing muscles.',
    facts: ['It is the largest cranial nerve.', 'Trigeminal neuralgia causes severe stabbing facial pain.', 'Dentists numb branches of this nerve before treating teeth.'],
  },
  facialNerve: {
    name: 'Facial nerve (CN VII)', latin: 'Nervus facialis', region: 'head', view: 'side',
    desc: 'The seventh cranial nerve. It controls the muscles of facial expression and carries taste from the front of the tongue.',
    facts: ['It fans out into five branches: temporal, zygomatic, buccal, mandibular and cervical.', 'Bell\'s palsy is a sudden weakness of this nerve.', 'It also controls tears and saliva production.'],
  },
  vagus: {
    name: 'Vagus nerve (CN X)', latin: 'Nervus vagus', region: 'neck', view: 'front',
    desc: 'The tenth cranial nerve. It wanders from the brainstem through the neck and chest into the abdomen, controlling heart rate, breathing and digestion.',
    facts: ['"Vagus" means wandering – it is the longest cranial nerve.', 'It carries most of the parasympathetic ("rest and digest") signals.', 'Vagus nerve stimulation is used to treat some epilepsy and depression.'],
  },
  sympatheticTrunk: {
    name: 'Sympathetic trunk', latin: 'Truncus sympathicus', region: 'trunk', view: 'front',
    desc: 'A chain of nerve ganglia running along each side of the spine. It is part of the autonomic nervous system that drives the "fight or flight" response.',
    facts: ['It speeds up the heart, widens the pupils and slows digestion in stress.', 'It runs from the base of the skull to the coccyx.', 'The beads along the chain are clusters of nerve cell bodies (ganglia).'],
  },
  spinalNerves: {
    name: 'Spinal nerves', latin: 'Nervi spinales', region: 'trunk', view: 'back',
    desc: '31 pairs of nerves that leave the spinal cord between the vertebrae. Each carries both motor and sensory fibres to one body segment.',
    facts: ['8 cervical, 12 thoracic, 5 lumbar, 5 sacral and 1 coccygeal pair.', 'The skin area supplied by one spinal nerve is called a dermatome.', 'A herniated disc can press on a spinal nerve, causing sciatica or arm pain.'],
  },
  intercostalNerves: {
    name: 'Intercostal nerves', latin: 'Nervi intercostales', region: 'trunk', view: 'side',
    desc: 'The front branches of thoracic spinal nerves T1–T11. They run beneath each rib, supplying the chest wall muscles and skin.',
    facts: ['They run in a groove on the underside of each rib, with an artery and vein.', 'Shingles often follows the path of an intercostal nerve.', 'The lower ones also supply the abdominal wall.'],
  },
  brachialPlexus: {
    name: 'Brachial plexus', latin: 'Plexus brachialis', region: 'upper', view: 'front',
    desc: 'A network of nerves formed by spinal roots C5–T1 in the neck and armpit. It gives rise to all the nerves of the arm, including the axillary and musculocutaneous nerves.',
    facts: ['It is organised into roots, trunks, divisions, cords and branches.', 'Birth injuries to it can cause Erb\'s palsy.', 'Anaesthetists block it to numb the whole arm for surgery.'],
  },
  radialNerve: {
    name: 'Radial nerve', latin: 'Nervus radialis', region: 'upper', view: 'back',
    desc: 'The nerve that spirals around the back of the humerus. It powers the muscles that straighten the elbow, wrist and fingers.',
    facts: ['Damage causes "wrist drop".', '"Saturday night palsy" happens when it is compressed by hanging an arm over a chair.', 'It supplies the triceps and all forearm extensors.'],
  },
  medianNerve: {
    name: 'Median nerve', latin: 'Nervus medianus', region: 'upper', view: 'front',
    desc: 'The nerve running down the middle of the arm and through the carpal tunnel. It controls most forearm flexors and the thumb muscles.',
    facts: ['Its compression in the wrist causes carpal tunnel syndrome.', 'It gives sensation to the thumb, index, middle and half of the ring finger.', 'Often called the "eye of the hand" for its role in fine touch.'],
  },
  ulnarNerve: {
    name: 'Ulnar nerve', latin: 'Nervus ulnaris', region: 'upper', view: 'front',
    desc: 'The nerve running along the little-finger side of the arm. It controls most small muscles of the hand.',
    facts: ['Hitting it behind the elbow causes the "funny bone" tingle.', 'It is the largest unprotected nerve in the body.', 'Damage can cause a "claw hand".'],
  },
  femoralNerve: {
    name: 'Femoral nerve', latin: 'Nervus femoralis', region: 'lower', view: 'front',
    desc: 'The largest branch of the lumbar plexus (L2–L4). It supplies the quadriceps and the skin of the front thigh; its saphenous branch reaches the inner leg.',
    facts: ['It passes under the inguinal ligament next to the femoral artery.', 'Damage makes it difficult to straighten the knee.', 'The saphenous nerve is its longest branch.'],
  },
  sciaticNerve: {
    name: 'Sciatic nerve', latin: 'Nervus ischiadicus', region: 'lower', view: 'back',
    desc: 'The largest and longest nerve in the body. It runs from the lower spine through the buttock and down the back of the thigh, splitting above the knee.',
    facts: ['It is about as thick as a thumb at its origin.', 'Irritation of its roots causes "sciatica" – pain shooting down the leg.', 'It divides into the tibial and common fibular nerves.'],
  },
  tibialNerve: {
    name: 'Tibial nerve', latin: 'Nervus tibialis', region: 'lower', view: 'back',
    desc: 'A branch of the sciatic nerve that runs through the calf and behind the inner ankle into the sole. It controls the calf muscles and the sole of the foot.',
    facts: ['It passes through the tarsal tunnel behind the medial malleolus.', 'It supplies the gastrocnemius and soleus.', 'It splits into the plantar nerves of the foot.'],
  },
  commonFibular: {
    name: 'Common fibular (peroneal) nerve', latin: 'Nervus fibularis communis', region: 'lower', view: 'side',
    desc: 'A branch of the sciatic nerve that wraps around the neck of the fibula. It supplies the muscles that lift the foot and turn it outward.',
    facts: ['It lies just under the skin at the fibular neck, making it easy to injure.', 'Crossing the legs for a long time can compress it.', 'Damage causes foot drop.'],
  },
};
